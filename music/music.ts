import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  entersState,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import type { Guild, TextBasedChannel, VoiceBasedChannel } from "discord.js";

const execFileAsync = promisify(execFile);

export interface Track {
  title: string;
  url: string;
  thumbnail?: string;
  retried?: boolean;
}

interface GuildMusic {
  player: AudioPlayer;
  connection: VoiceConnection;
  queue: Track[];
  current: Track | null;
  loop: boolean;
  paused: boolean;
  textChannel: TextBasedChannel | null;
  onTrackChange?: (track: Track) => void;
  onError?: (track: Track, reason: string) => void;
  onQueueEmpty?: () => void;
  onIdleTimeout?: () => void;
  processes: { ytdlp: ChildProcess; ffmpeg: ChildProcess } | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const states = new Map<string, GuildMusic>();

const MAX_PLAYLIST_TRACKS = 50;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_DELAY_MS = 2_000;

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    console.error("[MUSIC] retrying after error:", error instanceof Error ? error.message : error);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return task();
  }
}

export function isPlaylistUrl(text: string): boolean {
  return /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/\S*[?&]list=/i.test(text) ||
    /^https?:\/\/(www\.|m\.)?youtube\.com\/playlist\?list=/i.test(text);
}

export async function getPlaylistTracks(url: string): Promise<Track[]> {
  const { stdout } = await withRetry(() =>
    execFileAsync("yt-dlp", [
      "--flat-playlist",
      "--playlist-end",
      String(MAX_PLAYLIST_TRACKS),
      "--print",
      "%(id)s\t%(title)s",
      "--no-warnings",
      url,
    ]),
  );

  const tracks: Track[] = [];

  for (const line of stdout.split("\n")) {
    const [id, ...titleParts] = line.split("\t");
    const title = titleParts.join("\t").trim();

    if (!/^[\w-]{11}$/.test(id ?? "") || !title) continue;

    tracks.push({
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
  }

  if (tracks.length === 0) {
    throw new Error("No tracks found in playlist.");
  }

  return tracks;
}

export async function searchTrack(query: string): Promise<Track> {
  const { stdout } = await withRetry(() =>
    execFileAsync("yt-dlp", [
      `ytsearch1:${query}`,
      "--print",
      "%(title)s\n%(webpage_url)s\n%(thumbnail)s",
      "--no-playlist",
      "--no-warnings",
    ]),
  );

  const [title, url, thumbnail] = stdout.trim().split("\n");

  if (!title || !url) {
    throw new Error("No results found.");
  }

  return { title, url, thumbnail: thumbnail || undefined };
}

async function getAudioStreamUrl(pageUrl: string): Promise<string> {
  const { stdout } = await execFileAsync("yt-dlp", [
    "-f",
    "bestaudio",
    "-g",
    "--no-playlist",
    "--no-warnings",
    pageUrl,
  ]);

  return stdout.trim();
}

async function ensureState(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
): Promise<GuildMusic> {
  const existing = states.get(guild.id);
  if (existing) return existing;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  connection.subscribe(player);

  const state: GuildMusic = {
    player,
    connection,
    queue: [],
    current: null,
    loop: false,
    paused: false,
    textChannel: null,
    processes: null,
    idleTimer: null,
  };

  player.on(AudioPlayerStatus.Playing, () => {
    console.log(`[MUSIC] Playing in ${guild.name}`);
  });

  player.on(AudioPlayerStatus.Idle, () => {
    if (state.loop && state.current) {
      state.queue.unshift(state.current);
    }
    void playNext(guild.id);
  });

  player.on("error", (error) => {
    console.error("[MUSIC] Player error:", error);
    void playNext(guild.id);
  });

  connection.on("stateChange", (oldState, newState) => {
    console.log(`[VOICE] ${oldState.status} -> ${newState.status}`);
  });

  states.set(guild.id, state);
  return state;
}

async function playNext(guildId: string): Promise<void> {
  const state = states.get(guildId);
  if (!state) return;

  const next = state.queue.shift();

  if (!next) {
    state.current = null;
    state.paused = false;
    state.onQueueEmpty?.();
    startIdleTimer(state, guildId);
    return;
  }

  clearIdleTimer(state);
  killProcesses(state);

  try {
    const ytdlp = spawn("yt-dlp", [
      "-f",
      "bestaudio",
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
      next.url,
    ]);

    const ffmpeg = spawn("ffmpeg", [
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "pipe:1",
    ]);

    state.processes = { ytdlp, ffmpeg };

    let stderrText = "";

    ytdlp.stdout.on("error", () => null);
    ffmpeg.stdin.on("error", () => null);
    ffmpeg.stdout.on("error", () => null);
    ytdlp.stderr.on("data", (chunk) => {
      stderrText += chunk.toString();
      console.error("[yt-dlp]", chunk.toString());
    });
    ffmpeg.stderr.on("data", (chunk) => console.error("[ffmpeg]", chunk.toString()));
    ytdlp.on("error", (error) => console.error("[yt-dlp] spawn error:", error));
    ffmpeg.on("error", (error) => console.error("[ffmpeg] spawn error:", error));

    ytdlp.on("close", (code) => {
      if (code !== 0 && state.current === next) {
        console.error(`[MUSIC] yt-dlp exited with code ${code} for "${next.title}"`);

        if (!next.retried) {
          next.retried = true;
          state.queue.unshift(next);
          console.error(`[MUSIC] retrying "${next.title}" once`);
        } else {
          state.onError?.(next, stderrText.trim() || `exit code ${code}`);
        }
        state.player.stop();
      }
    });

    ytdlp.stdout.pipe(ffmpeg.stdin);

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
    });

    state.current = next;
    state.paused = false;
    state.player.play(resource);
    state.onTrackChange?.(next);
  } catch (error) {
    console.error(error);
    await playNext(guildId);
  }
}

function killProcesses(state: GuildMusic): void {
  state.processes?.ytdlp.kill("SIGKILL");
  state.processes?.ffmpeg.kill("SIGKILL");
  state.processes = null;
}

function clearIdleTimer(state: GuildMusic): void {
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
}

function startIdleTimer(state: GuildMusic, guildId: string): void {
  clearIdleTimer(state);
  state.idleTimer = setTimeout(() => {
    state.idleTimer = null;
    console.log(`[MUSIC] Idle timeout reached for guild ${guildId}, disconnecting.`);
    state.onIdleTimeout?.();
    stop(guildId);
  }, IDLE_TIMEOUT_MS);
}

export async function enqueue(
  guild: Guild,
  voiceChannel: VoiceBasedChannel,
  track: Track,
  textChannel: TextBasedChannel,
  onTrackChange: (track: Track) => void,
  onError?: (track: Track, reason: string) => void,
  onQueueEmpty?: () => void,
  onIdleTimeout?: () => void,
): Promise<{ position: number; playingNow: boolean }> {
  const state = await ensureState(guild, voiceChannel);
  state.textChannel = textChannel;
  state.onTrackChange = onTrackChange;
  state.onError = onError;
  state.onQueueEmpty = onQueueEmpty;
  state.onIdleTimeout = onIdleTimeout;
  clearIdleTimer(state);
  state.queue.push(track);

  const playingNow = state.current === null;
  if (playingNow) {
    await playNext(guild.id);
  }

  return { position: state.queue.length, playingNow };
}

export function getState(guildId: string): GuildMusic | undefined {
  return states.get(guildId);
}

export function getQueue(guildId: string): Track[] {
  return states.get(guildId)?.queue ?? [];
}

export function getCurrent(guildId: string): Track | null {
  return states.get(guildId)?.current ?? null;
}

export function togglePause(guildId: string): boolean | null {
  const state = states.get(guildId);
  if (!state || !state.current) return null;

  if (state.paused) {
    state.player.unpause();
    state.paused = false;
  } else {
    state.player.pause();
    state.paused = true;
  }
  return state.paused;
}

export function skip(guildId: string): boolean {
  const state = states.get(guildId);
  if (!state || !state.current) return false;
  state.player.stop();
  return true;
}

export function toggleLoop(guildId: string): boolean | null {
  const state = states.get(guildId);
  if (!state) return null;
  state.loop = !state.loop;
  return state.loop;
}

export function shuffle(guildId: string): number {
  const state = states.get(guildId);
  if (!state) return 0;
  for (let i = state.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  }
  return state.queue.length;
}

export function clearQueue(guildId: string): number {
  const state = states.get(guildId);
  if (!state) return 0;
  const count = state.queue.length;
  state.queue = [];
  return count;
}

export function stop(guildId: string): void {
  const state = states.get(guildId);
  if (state) {
    clearIdleTimer(state);
    killProcesses(state);
    state.queue = [];
    state.current = null;
    state.loop = false;
    state.player.stop();
    state.connection.destroy();
  }
  states.delete(guildId);
}

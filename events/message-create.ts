import { Events, type Message, type TextChannel } from "discord.js";
import { getGuild } from "../db/database.ts";
import {
  enqueue,
  getCurrent,
  getPlaylistTracks,
  isPlaylistUrl,
  searchTrack,
  type Track,
} from "../music/music.ts";
import { updatePanel } from "../music/panel.ts";

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const guild = getGuild(message.guild.id);

  if (guild?.allowed !== 1 || guild.channel_id !== message.channel.id) return;
  if (!guild.panel_message_id) return;

  const channel = message.channel as TextChannel;
  const panelId = guild.panel_message_id;

  const query = message.content.trim();
  if (!query) return;

  await message.delete().catch(() => null);

  const voiceChannel = message.member?.voice.channel;

  if (!voiceChannel) {
    await sendTemporary(channel, "Join a voice channel first, then type a song name.");
    return;
  }

  if (isPlaylistUrl(query)) {
    const loading = await channel.send({
      content: "Loading playlist...",
      allowedMentions: { parse: [] },
    });

    try {
      const tracks = await getPlaylistTracks(query);
      await loading.delete().catch(() => null);

      let playingNow = false;
      for (const track of tracks) {
        const result = await enqueue(
          message.guild,
          voiceChannel,
          track,
          channel,
          (nowPlaying: Track) => {
            void updatePanel(channel, panelId, nowPlaying, "Now playing");
          },
          (failed: Track) => {
            void sendTemporary(
              channel,
              `Could not play **${failed.title}** (YouTube blocked it). Skipping to the next track.`,
            );
          },
          () => {
            void updatePanel(channel, panelId, null);
          },
        );
        playingNow ||= result.playingNow;
      }

      await updatePanel(channel, panelId, getCurrent(message.guild.id), `Added ${tracks.length} tracks from the playlist.`);
    } catch (error) {
      console.error(error);
      await loading.delete().catch(() => null);
      await sendTemporary(channel, "Could not load that playlist.");
    }
    return;
  }

  const searching = await channel.send({
    content: `Searching for **${query}**...`,
    allowedMentions: { parse: [] },
  });

  try {
    const track = await searchTrack(query);
    await searching.delete().catch(() => null);

    const { playingNow } = await enqueue(
      message.guild,
      voiceChannel,
      track,
      channel,
      (nowPlaying: Track) => {
        void updatePanel(channel, panelId, nowPlaying, "Now playing");
      },
      (failed: Track) => {
        void sendTemporary(
          channel,
          `Could not play **${failed.title}** (YouTube blocked it). Skipping to the next track.`,
        );
      },
      () => {
        void updatePanel(channel, panelId, null);
      },
      () => {
        void updatePanel(channel, panelId, null);
        void sendTemporary(channel, "Disconnected due to inactivity.");
      },
    );

    if (!playingNow) {
      await updatePanel(channel, panelId, getCurrent(message.guild.id), undefined);
    }
  } catch (error) {
    console.error(error);
    await searching.delete().catch(() => null);
    await sendTemporary(channel, "Could not find or play that track. Try a different name.");
  }
}

async function sendTemporary(channel: TextChannel, content: string): Promise<void> {
  const notice = await channel.send({ content, allowedMentions: { parse: [] } });
  setTimeout(() => void notice.delete().catch(() => null), 5_000);
}

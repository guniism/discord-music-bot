import {
  AttachmentBuilder,
  EmbedBuilder,
  type Message,
  type TextChannel,
} from "discord.js";
import path from "node:path";
import { controlEmojis } from "./components.ts";
import { getQueue, type Track } from "./music.ts";

export const PANEL_COLOR = 0x7e3352;

const DEFAULT_IMAGE_PATH = path.join(import.meta.dirname, "..", "assets", "mikasa.png");
const DEFAULT_IMAGE_NAME = "mikasa.png";

const QUEUE_HEADER = "__**Queue list:**__\nJoin a voice channel and queue songs by name or url in here.";

const MAX_QUEUE_SHOWN = 10;

export function buildQueueField(queue: Track[]): { name: string; value: string } | null {
  if (queue.length === 0) return null;

  const shown = queue.slice(0, MAX_QUEUE_SHOWN);
  const lines = shown.map((track, index) => `${index + 1}. ${track.title}`);

  if (queue.length > MAX_QUEUE_SHOWN) {
    lines.push(`...and ${queue.length - MAX_QUEUE_SHOWN} more`);
  }

  return { name: `Up next (${queue.length})`, value: lines.join("\n") };
}

export function buildPanelEmbed(
  track: Track | null,
  status?: string,
  queue: Track[] = [],
): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(PANEL_COLOR);

  if (!track) {
    embed
      .setTitle("No song playing currently")
      .setDescription(status ?? "Type a song name in this channel to start.")
      .setImage(`attachment://${DEFAULT_IMAGE_NAME}`);
  } else {
    embed
      .setAuthor({ name: "Now playing" })
      .setTitle(track.title);

    if (URL.canParse(track.url)) {
      embed.setURL(track.url);
    }

    if (status) {
      embed.setDescription(status);
    }

    if (track.thumbnail && URL.canParse(track.thumbnail)) {
      embed.setImage(track.thumbnail);
    }
  }

  const queueField = buildQueueField(queue);
  if (queueField) {
    embed.addFields(queueField);
  }

  return embed;
}

function buildFiles(track: Track | null): AttachmentBuilder[] {
  if (track) return [];
  return [new AttachmentBuilder(DEFAULT_IMAGE_PATH, { name: DEFAULT_IMAGE_NAME })];
}

export async function createPanel(channel: TextChannel): Promise<Message> {
  const panel = await channel.send({
    content: QUEUE_HEADER,
    embeds: [buildPanelEmbed(null)],
    files: buildFiles(null),
    allowedMentions: { parse: [] },
  });

  for (const emoji of controlEmojis) {
    await panel.react(emoji);
  }

  return panel;
}

export async function updatePanel(
  channel: TextChannel,
  messageId: string,
  track: Track | null,
  status?: string,
): Promise<void> {
  const panel = await channel.messages.fetch(messageId).catch(() => null);
  if (!panel) return;

  await panel.edit({
    content: QUEUE_HEADER,
    embeds: [buildPanelEmbed(track, status, getQueue(channel.guildId))],
    files: buildFiles(track),
    attachments: track ? [] : undefined,
    allowedMentions: { parse: [] },
  });
}

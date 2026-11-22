import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import {
  clearQueue,
  getState,
  shuffle,
  skip,
  stop,
  toggleLoop,
  togglePause,
} from "../music/music.ts";
import { Controls, controlEmojis } from "../music/components.ts";
import { getGuild } from "../db/database.ts";
import { updatePanel } from "../music/panel.ts";
import type { TextChannel } from "discord.js";

export const name = Events.MessageReactionAdd;
export const once = false;

export async function execute(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (user.bot) return;

  const emoji = reaction.emoji.name;
  if (!emoji || !controlEmojis.includes(emoji as (typeof controlEmojis)[number])) return;

  if (reaction.partial) await reaction.fetch();
  const guild = reaction.message.guild;
  if (!guild) return;

  const saved = getGuild(guild.id);
  if (!saved || saved.panel_message_id !== reaction.message.id) return;

  const member = await guild.members.fetch(user.id);
  const userChannel = member.voice.channel;
  const state = getState(guild.id);

  await reaction.users.remove(user.id).catch(() => null);

  if (!state || !userChannel || userChannel.id !== state.connection.joinConfig.channelId) {
    return;
  }

  switch (emoji) {
    case Controls.PlayPause:
      togglePause(guild.id);
      break;
    case Controls.Stop:
      stop(guild.id);
      await updatePanel(
        reaction.message.channel as TextChannel,
        saved.panel_message_id,
        null,
      );
      break;
    case Controls.Skip:
      skip(guild.id);
      break;
    // case "🔁":
    //   toggleLoop(guild.id);
    //   break;
    // case "🔀":
    //   shuffle(guild.id);
    //   break;
    // case "❌":
    //   clearQueue(guild.id);
    //   break;
  }
}

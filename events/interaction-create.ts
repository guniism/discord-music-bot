import {
  Collection,
  Events,
  MessageFlags,
  type Interaction,
} from "discord.js";
import "../types.ts";
import { isGuildAllowed } from "../db/database.ts";

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  const ownerOnly = command.data.name !== "setup";

  if (ownerOnly && interaction.user.id !== process.env.OWNER_ID) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const bypassGuildCheck = ["setup", "allow", "servers"];

  if (!bypassGuildCheck.includes(command.data.name) && interaction.guild) {
    if (!isGuildAllowed(interaction.guild.id)) {
      await interaction.reply({
        content: "This server is not set up yet. Run `/setup` first, or contact the bot owner.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const { cooldowns } = interaction.client;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.data.name)!;
  const defaultCooldownDuration = 3;
  const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

    if (now < expirationTime) {
      const expiredTimestamp = Math.round(expirationTime / 1_000);
      await interaction.reply({
        content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const payload = {
      content: "There was an error while executing this command!",
      flags: MessageFlags.Ephemeral,
    } as const;
    await (interaction.replied || interaction.deferred
      ? interaction.followUp(payload)
      : interaction.reply(payload)
    ).catch((replyError: unknown) => console.error("[REPLY FAILED]", replyError));
  }
}

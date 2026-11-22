import {
  SlashCommandBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { pathToFileURL } from "node:url";
import type { Command } from "../../types.ts";

process.loadEnvFile(".env");
const ownerId = process.env.OWNER_ID;

export const data = new SlashCommandBuilder()
  .setName("reload")
  .setDescription("Reloads a command.")
  .addStringOption((option) =>
    option
      .setName("command")
      .setDescription("The command to reload.")
      .setRequired(true),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({
      content: "You are not allowed to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const commandName = interaction.options
    .getString("command", true)
    .toLowerCase();
  const command = interaction.client.commands.get(commandName);

  if (!command || !command.filePath) {
    await interaction.reply({
      content: `There is no command with name \`${commandName}\`!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    // Adding a query string makes Node import the file again instead of using the cached version
    const newCommand: Command = await import(
      `${pathToFileURL(command.filePath).href}?update=${Date.now()}`
    );
    interaction.client.commands.set(newCommand.data.name, {
      ...newCommand,
      filePath: command.filePath,
    });
    await interaction.reply({
      content: `Command \`${newCommand.data.name}\` was reloaded!`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    await interaction.reply({
      content: `There was an error while reloading a command \`${command.data.name}\`:\n\`${message}\``,
      flags: MessageFlags.Ephemeral,
    });
  }
}

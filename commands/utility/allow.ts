import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getGuild, setGuildAllowed } from "../../db/database.ts";

process.loadEnvFile(".env");
const ownerId = process.env.OWNER_ID;

export const data = new SlashCommandBuilder()
  .setName("allow")
  .setDescription("Allow or block a server from using the bot (owner only).")
  .addStringOption((option) =>
    option
      .setName("guild_id")
      .setDescription("The server ID")
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName("allowed")
      .setDescription("true to allow, false to block")
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

  const guildId = interaction.options.getString("guild_id", true);
  const allowed = interaction.options.getBoolean("allowed", true);
  const guild = getGuild(guildId);

  if (!guild) {
    await interaction.reply({
      content: `No server with ID \`${guildId}\` is registered.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  setGuildAllowed(guildId, allowed);
  await interaction.reply({
    content: `**${guild.name}** is now ${allowed ? "allowed" : "blocked"}.`,
    flags: MessageFlags.Ephemeral,
  });
}

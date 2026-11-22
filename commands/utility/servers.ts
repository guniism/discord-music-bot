import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { listGuilds, type GuildRow } from "../../db/database.ts";

export const data = new SlashCommandBuilder()
  .setName("servers")
  .setDescription("List all servers the bot is in and their status (owner only).");

function describe(guild: GuildRow): { allowed: string; setup: string } {
  return {
    allowed: guild.allowed === 1 ? "allowed" : "not allowed",
    setup: guild.channel_id ? `set up (channel ${guild.channel_id})` : "not set up",
  };
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guilds = listGuilds();

  if (guilds.length === 0) {
    await interaction.reply({
      content: "The bot is not registered in any server yet.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rows = guilds.map((guild) => ({ guild, ...describe(guild) }));

  console.log("");
  console.log(`Servers (${guilds.length})`);
  console.log("-".repeat(72));
  for (const { guild, allowed, setup } of rows) {
    console.log(`${guild.name}`);
    console.log(`   ID      : ${guild.id}`);
    console.log(`   Allowed : ${allowed}`);
    console.log(`   Setup   : ${setup}`);
    console.log("-".repeat(72));
  }

  const lines = rows.map(
    ({ guild, allowed, setup }) =>
      `**${guild.name}**\n> ID: \`${guild.id}\`\n> Allowed: ${allowed}\n> Setup: ${setup}`,
  );

  await interaction.reply({
    content: `**Servers (${guilds.length})**\n\n${lines.join("\n\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}

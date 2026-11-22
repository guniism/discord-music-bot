import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import {
  getGuild,
  saveGuild,
  setGuildChannel,
  setGuildPanel,
} from "../../db/database.ts";
import { createPanel } from "../../music/panel.ts";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Register this server with the bot.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

const inProgress = new Set<string>();

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { id, name } = interaction.guild;

  if (inProgress.has(id)) {
    await interaction.reply({
      content: "Setup is already running for this server. Please wait.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  saveGuild(id, name);
  const guild = getGuild(id);

  if (guild?.allowed !== 1) {
    console.log(`[SETUP] ${name} (${id}) is not allowed yet.`);
    await interaction.editReply({
      content: `**${name}** is registered, but you don't have permission to use this bot yet. Please contact the bot owner.`,
    });
    return;
  }

  inProgress.add(id);
  try {
    const existing = guild.channel_id
      ? await interaction.guild.channels.fetch(guild.channel_id).catch(() => null)
      : null;

    if (existing && existing.type === ChannelType.GuildText) {
      const textChannel = existing as TextChannel;
      const panelExists = guild.panel_message_id
        ? await textChannel.messages.fetch(guild.panel_message_id).catch(() => null)
        : null;

      if (panelExists) {
        console.log(`[SETUP] ${name} (${id}) already has channel ${textChannel.id}.`);
        await interaction.editReply({
          content: `Setup already done. The channel ${textChannel} already exists.`,
        });
        return;
      }

      const panel = await createPanel(textChannel);
      setGuildPanel(id, panel.id);
      console.log(`[SETUP] ${name} (${id}) recreated panel in ${textChannel.id}.`);
      await interaction.editReply({
        content: `Setup complete. Panel added to ${textChannel}.`,
      });
      return;
    }

    const channel = (await interaction.guild.channels.create({
      name: interaction.user.username,
      type: ChannelType.GuildText,
    })) as TextChannel;

    setGuildChannel(id, channel.id);

    const panel = await createPanel(channel);
    setGuildPanel(id, panel.id);

    console.log(`[SETUP] ${name} (${id}) channel ${channel.id} and panel ${panel.id} ready.`);
    await interaction.editReply({
      content: `Setup complete. Created ${channel}.`,
    });
  } finally {
    inProgress.delete(id);
  }
}

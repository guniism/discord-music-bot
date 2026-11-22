import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("echo")
  .setDescription("Replies with your input!")
  .addStringOption((option) =>
    option
      .setName("input")
      .setDescription("The input to echo back")
      .setRequired(true)
      // Ensure the text will fit in an embed description, if the user chooses that option
      .setMaxLength(2_000),
  )
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("The channel to echo into")
      // Ensure the user can only select a text channel for output
      .addChannelTypes(ChannelType.GuildText),
  )
  .addBooleanOption((option) =>
    option
      .setName("ephemeral")
      .setDescription("Whether or not the echo should be ephemeral"),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const input = interaction.options.getString("input", true);
  const channel = interaction.options.getChannel("channel");
  const ephemeral = interaction.options.getBoolean("ephemeral") ?? false;

  if (channel) {
    if (!channel.isTextBased() || !("send" in channel)) {
      await interaction.reply({
        content: "That channel can't receive messages.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await channel.send(input);
    await interaction.reply({
      content: `Echoed into ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: input,
    flags: ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}

import {
  GuildMember,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("user")
  .setDescription("Provides information about the user.");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  // interaction.user is the object representing the User who ran the command
  // interaction.member is the GuildMember object, which represents the user in the specific guild
  const member = interaction.member;
  const joinedAt =
    member instanceof GuildMember ? member.joinedAt : null;

  await interaction.reply(
    `This command was run by ${interaction.user.username}${joinedAt ? ` (joined ${joinedAt.toDateString()})` : ""}.`,
  );
}

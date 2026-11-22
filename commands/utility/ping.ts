import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';

export const cooldown = 5;

export const data = new SlashCommandBuilder()
	.setName('ping')
	.setDescription('Replies with Pong!');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.reply('Pong!');
}

import {
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

const topics = [
  "Popular Topics: Threads",
  "Sharding: Getting started",
  "Library: Voice Connections",
  "Interactions: Replying to slash commands",
  "Popular Topics: Embed preview",
];

export const data = new SlashCommandBuilder()
  .setName("guide")
  .setDescription("Search discordjs.guide!")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("Phrase to search for")
      .setAutocomplete(true),
  );

export async function autocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  const filtered = topics.filter((topic) =>
    topic.toLowerCase().startsWith(focusedValue.toLowerCase()),
  );

  await interaction.respond(
    filtered.slice(0, 25).map((topic) => ({ name: topic, value: topic })),
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const query = interaction.options.getString("query", true);

  await interaction.reply(`You searched for: ${query}`);
}

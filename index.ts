// Require the necessary discord.js classes
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { BotEvent, Command } from "./types.ts";

process.loadEnvFile(".env");
const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is not set in .env");
}

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.User],
});

client.commands = new Collection();
client.cooldowns = new Collection();
const foldersPath = path.join(import.meta.dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command: Partial<Command> = await import(
      pathToFileURL(filePath).href
    );

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if (command.data && command.execute) {
      client.commands.set(command.data.name, { ...command, filePath } as Command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

const eventsPath = path.join(import.meta.dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event: BotEvent = await import(pathToFileURL(filePath).href);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord with your client's token
client.login(token);

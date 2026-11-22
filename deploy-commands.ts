import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

process.loadEnvFile('.env');
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
	throw new Error('DISCORD_TOKEN, CLIENT_ID and GUILD_ID must be set in .env');
}

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

// Grab all the command folders from the commands directory
const foldersPath = path.join(import.meta.dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs
		.readdirSync(commandsPath)
		.filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = await import(pathToFileURL(filePath).href);

		if (command.data && command.execute) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
try {
	console.log(`Started refreshing ${commands.length} application (/) commands.`);

	// The put method is used to fully refresh all commands in the guild with the current set
	const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

	console.log(`Successfully reloaded ${(data as unknown[]).length} application (/) commands.`);
} catch (error) {
	// And of course, make sure you catch and log any errors!
	console.error(error);
}

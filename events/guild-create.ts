import { Events, type Guild } from "discord.js";
import { saveGuild } from "../db/database.ts";

export const name = Events.GuildCreate;
export const once = false;

export function execute(guild: Guild): void {
  saveGuild(guild.id, guild.name);
  console.log(`[JOIN] ${guild.name} (${guild.id}) added the bot. Waiting for approval.`);
}

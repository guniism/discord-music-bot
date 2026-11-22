import { Events, type Client, type TextChannel } from "discord.js";
import { listGuilds } from "../db/database.ts";
import { updatePanel } from "../music/panel.ts";

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client<true>): Promise<void> {
  console.log(`Ready! Logged in as ${client.user.tag}`);

  for (const guild of listGuilds()) {
    if (guild.allowed !== 1 || !guild.channel_id || !guild.panel_message_id) continue;

    const channel = await client.channels.fetch(guild.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.type !== 0) continue;

    await updatePanel(channel as TextChannel, guild.panel_message_id, null).catch(
      (error: unknown) => console.error(`[READY] reset panel failed for ${guild.name}:`, error),
    );
    console.log(`[READY] reset panel for ${guild.name}`);
  }
}

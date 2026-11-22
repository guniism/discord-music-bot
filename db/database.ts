import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(projectRoot, "data");
fs.mkdirSync(dataPath, { recursive: true });

export const db = new DatabaseSync(path.join(dataPath, "bot.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

const columns = db.prepare("PRAGMA table_info(guilds)").all() as { name: string }[];
if (!columns.some((column) => column.name === "channel_id")) {
  db.exec("ALTER TABLE guilds ADD COLUMN channel_id TEXT");
}
if (!columns.some((column) => column.name === "panel_message_id")) {
  db.exec("ALTER TABLE guilds ADD COLUMN panel_message_id TEXT");
}

export interface GuildRow {
  id: string;
  name: string;
  allowed: number;
  channel_id: string | null;
  panel_message_id: string | null;
  created_at: number;
}

export function setGuildChannel(id: string, channelId: string): void {
  db.prepare("UPDATE guilds SET channel_id = ? WHERE id = ?").run(channelId, id);
}

export function setGuildPanel(id: string, messageId: string): void {
  db.prepare("UPDATE guilds SET panel_message_id = ? WHERE id = ?").run(messageId, id);
}


export function saveGuild(id: string, name: string): void {
  db.prepare(
    `INSERT INTO guilds (id, name, allowed, created_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
  ).run(id, name, Date.now());
}

export function listGuilds(): GuildRow[] {
  return db.prepare("SELECT * FROM guilds ORDER BY created_at").all() as unknown as GuildRow[];
}

export function getGuild(id: string): GuildRow | undefined {
  return db.prepare("SELECT * FROM guilds WHERE id = ?").get(id) as
    | GuildRow
    | undefined;
}

export function isGuildAllowed(id: string): boolean {
  return getGuild(id)?.allowed === 1;
}

export function setGuildAllowed(id: string, allowed: boolean): void {
  db.prepare("UPDATE guilds SET allowed = ? WHERE id = ?").run(
    allowed ? 1 : 0,
    id,
  );
}

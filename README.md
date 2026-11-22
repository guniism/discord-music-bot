# Discord Music Bot

A Discord bot that plays music from YouTube in voice channels. Each server gets a dedicated text channel with a control panel. Type a song name (or a YouTube link) in that channel and the bot queues it and plays it. Playback is controlled with emoji reactions on the panel.

## Features

- Per-server setup with `/setup`, which creates a music channel and control panel
- Owner approval for servers (`/allow`) before the bot will respond there
- Search YouTube by name, or queue a single video or a whole playlist (up to 50 tracks)
- Queue with an "Up next" list shown on the panel
- Emoji reaction controls: play/pause, stop, skip
- Default panel image when nothing is playing
- Slash commands for utility and owner management

## Requirements

- [Node.js](https://nodejs.org) 22 or newer (uses the built-in `node:sqlite` module)
- [FFmpeg](https://ffmpeg.org)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- A Discord application with a bot user

No YouTube API key is required. Search and playback use `yt-dlp`.

### Install on macOS

```bash
brew install node@22 ffmpeg yt-dlp
```

### Install on Linux (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install ffmpeg
```

Node.js 22 is not in older `apt` repos. Install it with [nvm](https://github.com/nvm-sh/nvm) or from [nodejs.org](https://nodejs.org):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
```

For yt-dlp, the `apt` package is often outdated and YouTube breaks old versions. Install the latest binary instead:

```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

Other distributions (Fedora, Arch) use their own package managers: `sudo dnf install ffmpeg` or `sudo pacman -S ffmpeg yt-dlp`.

### Install on Windows

Open PowerShell and use [winget](https://learn.microsoft.com/windows/package-manager/winget/):

```powershell
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
winget install yt-dlp.yt-dlp
```

Node.js LTS must be version 22 or newer. Check with `node --version` and close and reopen the terminal after installing so the new commands are on your `PATH`.

Verify all three tools:

```bash
node --version
ffmpeg -version
yt-dlp --version
```

Windows-only note: the `@discordjs/opus` package may need build tools if no prebuilt binary matches your Node version. If `npm install` fails on it, install the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload, then run `npm install` again.

## Discord setup

1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**:
   - Copy the bot token.
   - Enable **Message Content Intent** (required to read song names).
3. Invite the bot to your server with the `bot` and `applications.commands` scopes. The bot needs these permissions in the music channel: **View Channel**, **Send Messages**, **Manage Messages**, **Read Message History**, **Add Reactions**, **Connect**, and **Speak**. It also needs **Manage Channels** to create the music channel during setup.

## Installation

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Bot token from the Developer Portal |
| `CLIENT_ID` | Application ID (General Information page) |
| `GUILD_ID` | ID of the server where slash commands are registered |
| `OWNER_ID` | Your Discord user ID (enable Developer Mode, right-click your name, Copy User ID) |

Never commit `.env`. It is listed in `.gitignore`.

## Running

Register slash commands (run after adding or changing command names, descriptions, or options):

```bash
npm run deploy
```

Start the bot:

```bash
npm start
```

## Usage

1. In a server where the bot is invited, run `/setup` (requires the **Manage Server** permission). The bot creates a channel named after you and posts the control panel.
2. The owner approves the server with `/allow guild_id:<id> allowed:true`. Use `/servers` to list servers and their status.
3. Join a voice channel, then type a song name, a video link, or a playlist link in the music channel. Your message is removed and the panel updates.
4. Use the reactions on the panel:
   - ⏯️ Play/Pause
   - ⏹️ Stop (clears the queue and leaves the voice channel)
   - ⏭️ Skip

## Commands

Slash commands:

| Command | Who | Description |
| --- | --- | --- |
| `/setup` | Members with Manage Server | Create the music channel and control panel for this server |
| `/allow guild_id allowed` | Owner | Approve or block a server |
| `/servers` | Owner | List servers with their allow and setup status |
| `/reload command` | Owner | Reload a command file without restarting |
| `/ping` | Owner | Replies with Pong! |
| `/server` | Owner | Shows server name and member count |
| `/user` | Owner | Shows your username and join date |
| `/echo input channel ephemeral` | Owner | Echoes text, optionally into a channel |
| `/guide query` | Owner | Search a list of guide topics (autocomplete) |

Only the owner can use commands other than `/setup`.

## Project structure

```
index.ts              entry point: client setup, loads commands and events
deploy-commands.ts    registers slash commands with Discord
types.ts              shared types (Command, BotEvent, Client augmentation)
db/
  database.ts         SQLite database (data/bot.db)
music/
  music.ts            queue, playback, yt-dlp and FFmpeg pipeline
  panel.ts            control panel embed and message updates
  components.ts       reaction emoji definitions
commands/utility/     slash commands (one file per command)
events/               Discord event handlers (one file per event)
assets/               images (mikasa.png is the default panel image)
data/                 SQLite database file (created at runtime)
```

Commands export `data` and `execute`. Events export `name`, `once`, and `execute`. Both are loaded automatically at startup.

## Database

SQLite is stored at `data/bot.db`. The `guilds` table tracks each server:

- `id`, `name`: server ID and name
- `allowed`: `1` when the owner has approved the server
- `channel_id`: the music channel created by `/setup`
- `panel_message_id`: the control panel message

The database is created automatically. Missing columns are added on startup.

## Troubleshooting

- **No sound:** check that FFmpeg and yt-dlp are installed, and that the bot can Connect and Speak in the voice channel. Look for `[VOICE]` and `[MUSIC]` lines in the console.
- **`HTTP Error 403: Forbidden` from YouTube:** update yt-dlp (`brew upgrade yt-dlp`). YouTube blocks outdated versions.
- **Duplicate `/setup` commands:** if an old global command still exists, delete it or re-run `npm run deploy`.
- **`Used disallowed intents`:** enable **Message Content Intent** in the Developer Portal.
- **Slash commands not showing:** run `npm run deploy` and restart Discord.

## Notes and limits

- Downloading or streaming YouTube audio may conflict with YouTube's terms of service and copyright rules. Use this bot for personal or private servers.
- Queue, playback state, and the panel's "Now playing" are kept in memory. A restart clears the queue; the panel is reset to the default on startup.
- Playlists are capped at 50 tracks.
- Search and playback retry once on failure. A track that still fails is skipped and reported in the channel.

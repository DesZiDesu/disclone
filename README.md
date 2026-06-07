# Disclone 🪄

A Discord bot with two slash commands:

- **`/clone`** — copies an entire server into another server by ID (see below).
- **`/ban`** — bans a user from the server by their **user ID** (works even if they've already left).

## `/clone`

Copies an entire server into another server by ID — including:

- ✅ Server **name** and **icon**
- ✅ All **roles** (name, color, hoist, mentionable, **permissions**, and hierarchy order)
- ✅ `@everyone` permissions
- ✅ All **categories**
- ✅ All **channels** (text, voice, announcement, stage, forum) with their **topic, NSFW flag, slowmode, bitrate, user limit**
- ✅ **Per-channel permission overwrites**, automatically re-mapped onto the newly created roles

> **What it does NOT copy:** messages, members, member-specific permission overwrites, emojis/stickers, webhooks, bans, and invites. Discord's API does not allow copying messages or members between servers.

---

## ⚠️ Use responsibly

Only clone servers **you own or have explicit permission to copy**. Cloning a server is an administrative action and is irreversible if you use the `wipe` option. You are responsible for how you use this bot.

---

## 1. Requirements

- [Node.js](https://nodejs.org/) **18 or newer**
- A Discord bot application

## 2. Create your bot application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Open the **Bot** tab → **Reset Token** → copy the token (this is your `DISCORD_TOKEN`).
3. Open **General Information** → copy the **Application ID** (this is your `CLIENT_ID`).
4. Invite the bot to **both** the source and target servers using the link below
   (replace `YOUR_CLIENT_ID`). The `8` requests the **Administrator** permission, which the bot needs to create roles/channels:

   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```

   > 💡 The bot **must be a member of the source server** to read it, and a member of the target server (with Manage Roles / Manage Channels / Manage Server, or just Administrator) to write to it.

## 3. Install & configure

```bash
git clone <this-repo>
cd disclone
npm install

# create your environment file
cp .env.example .env
```

Now edit `.env` and fill in your values:

```env
DISCORD_TOKEN=your-bot-token-here
CLIENT_ID=your-application-id-here
# Optional: put a server ID here to register the command instantly while testing.
GUILD_ID=
```

## 4. Register the slash command

```bash
npm run deploy
```

- If you set `GUILD_ID`, the command appears **instantly** in that server.
- If you leave it empty, the command is registered **globally** and may take up to ~1 hour to show up.

## 5. Run the bot

```bash
npm start
```

You should see: `✅ Logged in as <bot>#0000. Ready to clone servers!`

Keep this process running while you use the command.

---

## 6. Using the `/clone` command

Run this **inside the server you want to copy INTO** (the target):

```
/clone source_id:<ID of the server to copy FROM> wipe:<true|false>
```

| Option      | Required | Description                                                                                   |
| ----------- | -------- | --------------------------------------------------------------------------------------------- |
| `source_id` | ✅ Yes    | The ID of the server to **copy from**. The bot must be a member of it.                        |
| `wipe`      | ❌ No     | If `true`, deletes the target server's existing roles & channels **first**. Default: `false`. |

**Example:** you want to copy `123456789012345678` into your current server, starting fresh:

```
/clone source_id:123456789012345678 wipe:true
```

The bot will reply with live progress and finish with a summary of how many roles, categories and channels it created (and anything it had to skip).

### How do I get a server ID?

1. In Discord, open **User Settings → Advanced** and enable **Developer Mode**.
2. Right-click the server icon → **Copy Server ID**.

---

## 6b. Using the `/ban` command

Bans a user by their **user ID** — handy for banning people who have already left the server (where you can't right-click them). Run it in the server you want to ban them from:

```
/ban user_id:<the user's ID> reason:<optional> delete_days:<0-7>
```

| Option        | Required | Description                                                                     |
| ------------- | -------- | ------------------------------------------------------------------------------- |
| `user_id`     | ✅ Yes    | The ID of the user to ban.                                                      |
| `reason`      | ❌ No     | Reason recorded in the audit log. Default: `No reason provided`.                |
| `delete_days` | ❌ No     | Delete this many days (0–7) of the user's recent messages. Default: `0`.        |

**Example:**

```
/ban user_id:123456789012345678 reason:Spamming delete_days:1
```

- The command is only visible to members with the **Ban Members** permission.
- The bot also needs **Ban Members**, and its role must be **above** the target's role to ban someone currently in the server.
- To copy a **user** ID: enable Developer Mode (above), then right-click a user → **Copy User ID**.

---

## 7. Permissions cheat-sheet

| Where         | Who / What       | Needs                                                          |
| ------------- | ---------------- | ------------------------------------------------------------- |
| Source server | The **bot**      | To be a member (read access)                                  |
| Target server | The **bot**      | Manage Roles, Manage Channels, Manage Server (Administrator covers all) |
| Target server | The **user**     | Administrator (the command is hidden from everyone else)      |

> ℹ️ The bot can only create roles **below its own highest role**. Put the bot's role near the top of the target server's role list so it can recreate the full hierarchy.

---

## Project structure

```
disclone/
├── src/
│   ├── index.js            # Boots the bot, loads commands, handles interactions
│   ├── deploy-commands.js  # Registers slash commands with Discord
│   ├── config.js           # Loads & validates environment variables
│   ├── cloner.js           # The core server-cloning logic
│   └── commands/
│       ├── clone.js        # The /clone slash command
│       └── ban.js          # The /ban slash command
├── .env.example
├── package.json
└── README.md
```

## Troubleshooting

| Problem                                            | Fix                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `I'm not in a server with the ID ...`              | Invite the bot to the **source** server and make sure the ID is correct.                         |
| Roles created but appear below others / wrong order | Move the **bot's role to the top** of the target server, then re-run with `wipe:true`.           |
| Some channels skipped                               | They may be a type the bot can't recreate, or its role is too low. Check the summary message.    |
| Command doesn't show up                             | Run `npm run deploy`. Global commands can take up to 1 hour; use `GUILD_ID` for instant testing. |
| `Missing required environment variables`            | Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`.                        |

## License

MIT

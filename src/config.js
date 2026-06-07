import 'dotenv/config';

const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missing.join(', ')}\n` +
      `   Copy .env.example to .env and fill in the values.`,
  );
  process.exit(1);
}

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  // Optional: register commands to a single guild for instant testing.
  guildId: process.env.GUILD_ID || null,
};

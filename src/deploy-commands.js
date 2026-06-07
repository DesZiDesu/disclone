import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- Collect command definitions ----
const commands = [];
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = await import(pathToFileURL(join(commandsPath, file)).href);
  if ('data' in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(config.token);

try {
  console.log(`🚀 Registering ${commands.length} slash command(s)…`);

  if (config.guildId) {
    // Guild commands update instantly — best for testing.
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    console.log(`✅ Registered to guild ${config.guildId} (available immediately).`);
  } else {
    // Global commands can take up to ~1 hour to propagate.
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    console.log('✅ Registered globally (may take up to 1 hour to appear).');
  }
} catch (err) {
  console.error('❌ Failed to register commands:', err);
  process.exit(1);
}

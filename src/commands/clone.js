import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import { cloneGuild } from '../cloner.js';

export const data = new SlashCommandBuilder()
  .setName('clone')
  .setDescription('Clone another server (roles, permissions & channels) into THIS server.')
  .addStringOption((option) =>
    option
      .setName('source_id')
      .setDescription('The ID of the server to copy FROM (the bot must be a member of it).')
      .setRequired(true),
  )
  .addBooleanOption((option) =>
    option
      .setName('wipe')
      .setDescription('Delete this server\'s existing roles & channels first (default: false).')
      .setRequired(false),
  )
  // Only members with Administrator can even see/use the command.
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  const sourceId = interaction.options.getString('source_id', true);
  const wipe = interaction.options.getBoolean('wipe') ?? false;
  const target = interaction.guild;

  if (!target) {
    return interaction.reply({
      content: '❌ This command can only be used inside a server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sourceId === target.id) {
    return interaction.reply({
      content: '❌ The source server cannot be the same as this server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // The user must be allowed to manage the target server.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need the **Administrator** permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // The bot must be able to manage roles & channels here.
  const me = target.members.me;
  if (
    !me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
    !me?.permissions.has(PermissionFlagsBits.ManageChannels) ||
    !me?.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return interaction.reply({
      content:
        '❌ I need **Manage Roles**, **Manage Channels** and **Manage Server** permissions in this server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();

  // Make sure the bot is actually in the source server.
  let source;
  try {
    source = await interaction.client.guilds.fetch(sourceId);
  } catch {
    return interaction.editReply(
      `❌ I'm not in a server with the ID \`${sourceId}\`, or that ID is invalid.\n` +
        'Invite me to the source server first, then try again.',
    );
  }

  // Throttle progress edits so we don't spam the API.
  let lastEdit = 0;
  const onProgress = (text) => {
    const now = Date.now();
    if (now - lastEdit < 1200) return;
    lastEdit = now;
    interaction.editReply(`⏳ Cloning **${source.name}** → **${target.name}**\n${text}`).catch(() => {});
  };

  try {
    const summary = await cloneGuild(source, target, { wipe, onProgress });

    const lines = [
      `✅ Cloned **${source.name}** into **${target.name}**`,
      '',
      `• Roles created: **${summary.roles}**`,
      `• Categories created: **${summary.categories}**`,
      `• Channels created: **${summary.channels}**`,
    ];

    if (summary.skipped.length > 0) {
      const preview = summary.skipped.slice(0, 10).map((s) => `– ${s}`).join('\n');
      const extra = summary.skipped.length > 10 ? `\n…and ${summary.skipped.length - 10} more.` : '';
      lines.push('', `⚠️ Skipped ${summary.skipped.length} item(s):`, preview + extra);
    }

    let out = lines.join('\n');
    if (out.length > 2000) out = out.slice(0, 1990) + '\n…';
    await interaction.editReply(out);
  } catch (err) {
    console.error('Clone failed:', err);
    await interaction.editReply(`❌ Clone failed: ${err.message}`);
  }
}

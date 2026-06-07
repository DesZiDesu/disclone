import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user from this server by their user ID (works even if they have left).')
  .addStringOption((option) =>
    option
      .setName('user_id')
      .setDescription('The ID of the user to ban.')
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('reason')
      .setDescription('Reason for the ban (shown in the audit log).')
      .setRequired(false),
  )
  .addIntegerOption((option) =>
    option
      .setName('delete_days')
      .setDescription("How many days of the user's recent messages to delete (0-7, default: 0).")
      .setMinValue(0)
      .setMaxValue(7)
      .setRequired(false),
  )
  // Only members with Ban Members can see/use the command.
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  const userId = interaction.options.getString('user_id', true).trim();
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
  const guild = interaction.guild;

  if (!guild) {
    return interaction.reply({
      content: '❌ This command can only be used inside a server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Validate the ID looks like a Discord snowflake.
  if (!/^\d{17,20}$/.test(userId)) {
    return interaction.reply({
      content: `❌ \`${userId}\` is not a valid user ID. Enable Developer Mode and right-click a user → **Copy User ID**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // The user must be allowed to ban.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({
      content: '❌ You need the **Ban Members** permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // The bot must be allowed to ban.
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.reply({
      content: '❌ I need the **Ban Members** permission to do that.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (userId === interaction.user.id) {
    return interaction.reply({
      content: "❌ You can't ban yourself.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (userId === interaction.client.user.id) {
    return interaction.reply({
      content: "❌ I can't ban myself.",
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply();

  // Don't double-ban.
  const existingBan = await guild.bans.fetch(userId).catch(() => null);
  if (existingBan) {
    return interaction.editReply(`ℹ️ <@${userId}> (\`${userId}\`) is already banned.`);
  }

  // If the target is currently in the server, make sure we can act on them
  // (role hierarchy + not the owner).
  const member = await guild.members.fetch(userId).catch(() => null);
  if (member) {
    if (member.id === guild.ownerId) {
      return interaction.editReply("❌ I can't ban the server owner.");
    }
    if (!member.bannable) {
      return interaction.editReply(
        "❌ I can't ban that member — their role is higher than mine, or I'm missing permissions. " +
          'Move my role above theirs and try again.',
      );
    }
  }

  try {
    await guild.bans.create(userId, {
      reason: `${reason} — banned by ${interaction.user.tag} (${interaction.user.id})`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    await interaction.editReply(
      `🔨 Banned <@${userId}> (\`${userId}\`)\n` +
        `• Reason: ${reason}\n` +
        (deleteDays > 0 ? `• Deleted the last **${deleteDays}** day(s) of their messages.` : ''),
    );
  } catch (err) {
    console.error('Ban failed:', err);
    await interaction.editReply(`❌ Failed to ban that user: ${err.message}`);
  }
}

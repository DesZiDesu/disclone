import { ChannelType, PermissionsBitField } from 'discord.js';

// Channel types we know how to recreate.
const CATEGORY = ChannelType.GuildCategory;
const CLONEABLE_CHANNELS = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build the permissionOverwrites array for a target channel by mapping every
 * source overwrite onto the freshly-created target role. Member overwrites are
 * skipped because those members may not exist in the target guild.
 *
 * @param {import('discord.js').GuildChannel} sourceChannel
 * @param {Map<string,string>} roleMap  source role id -> target role id
 * @param {string} targetGuildId        used to remap the @everyone overwrite
 */
function buildOverwrites(sourceChannel, roleMap, targetGuildId, sourceGuildId) {
  const overwrites = [];

  for (const ow of sourceChannel.permissionOverwrites.cache.values()) {
    // type 0 = role, type 1 = member. We only clone role overwrites.
    if (ow.type !== 0) continue;

    let targetId;
    if (ow.id === sourceGuildId) {
      // The @everyone role always shares the guild's id.
      targetId = targetGuildId;
    } else {
      targetId = roleMap.get(ow.id);
    }
    if (!targetId) continue; // role wasn't cloned (e.g. managed/integration role)

    overwrites.push({
      id: targetId,
      allow: ow.allow.bitfield,
      deny: ow.deny.bitfield,
    });
  }

  return overwrites;
}

/**
 * Delete every (deletable) role and channel in the target guild so the clone
 * starts from a clean slate.
 */
async function wipeGuild(target, onProgress) {
  onProgress?.('🧹 Wiping existing channels…');
  for (const channel of [...target.channels.cache.values()]) {
    if (!channel?.deletable) continue;
    await channel.delete('Server clone: wiping target').catch(() => {});
  }

  onProgress?.('🧹 Wiping existing roles…');
  const me = target.members.me;
  for (const role of [...target.roles.cache.values()]) {
    if (role.id === target.id) continue; // never delete @everyone
    if (role.managed) continue; // bot/integration/boost roles can't be deleted
    if (me && role.position >= me.roles.highest.position) continue; // above us
    await role.delete('Server clone: wiping target').catch(() => {});
  }
}

/**
 * Clone the source guild's settings, roles, categories and channels into the
 * target guild.
 *
 * @returns {Promise<{roles:number, categories:number, channels:number, skipped:string[]}>}
 */
export async function cloneGuild(source, target, { wipe = false, onProgress } = {}) {
  const summary = { roles: 0, categories: 0, channels: 0, skipped: [] };

  // Make sure caches are populated.
  await source.roles.fetch();
  await source.channels.fetch();
  await target.roles.fetch();
  await target.channels.fetch();

  if (wipe) {
    await wipeGuild(target, onProgress);
  }

  // ---- 1. Guild-level settings (name + icon) ----
  onProgress?.('⚙️  Copying server name & icon…');
  try {
    const iconURL = source.iconURL({ extension: 'png', size: 1024 });
    await target.edit({
      name: source.name,
      ...(iconURL ? { icon: iconURL } : {}),
      reason: 'Server clone: guild settings',
    });
  } catch (err) {
    summary.skipped.push(`Guild settings (${err.message})`);
  }

  // ---- 2. Roles ----
  // Map of source role id -> target role id, used later for channel overwrites.
  const roleMap = new Map();
  const me = target.members.me;

  // @everyone: edit the target's existing one to match the source permissions.
  try {
    const sourceEveryone = source.roles.everyone;
    await target.roles.everyone.setPermissions(
      sourceEveryone.permissions.bitfield,
      'Server clone: @everyone permissions',
    );
  } catch (err) {
    summary.skipped.push(`@everyone permissions (${err.message})`);
  }

  // Clone the rest of the roles. Create highest-first so the hierarchy matches:
  // each newly created role is inserted just above @everyone, pushing the
  // previously created ones up.
  const rolesToClone = [...source.roles.cache.values()]
    .filter((role) => role.id !== source.id && !role.managed)
    .sort((a, b) => b.position - a.position);

  onProgress?.(`🎭 Creating ${rolesToClone.length} roles…`);
  for (const role of rolesToClone) {
    try {
      const created = await target.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: new PermissionsBitField(role.permissions.bitfield),
        reason: 'Server clone: role',
      });
      roleMap.set(role.id, created.id);
      summary.roles += 1;
    } catch (err) {
      summary.skipped.push(`Role "${role.name}" (${err.message})`);
    }
  }

  // ---- 3. Categories ----
  // Map source category id -> target category channel, so child channels can be
  // re-parented correctly.
  const categoryMap = new Map();
  const sourceCategories = [...source.channels.cache.values()]
    .filter((c) => c.type === CATEGORY)
    .sort((a, b) => a.rawPosition - b.rawPosition);

  onProgress?.(`📁 Creating ${sourceCategories.length} categories…`);
  for (const category of sourceCategories) {
    try {
      const created = await target.channels.create({
        name: category.name,
        type: CATEGORY,
        permissionOverwrites: buildOverwrites(category, roleMap, target.id, source.id),
        reason: 'Server clone: category',
      });
      categoryMap.set(category.id, created);
      summary.categories += 1;
    } catch (err) {
      summary.skipped.push(`Category "${category.name}" (${err.message})`);
    }
  }

  // ---- 4. Channels ----
  const sourceChannels = [...source.channels.cache.values()]
    .filter((c) => CLONEABLE_CHANNELS.has(c.type))
    .sort((a, b) => a.rawPosition - b.rawPosition);

  onProgress?.(`💬 Creating ${sourceChannels.length} channels…`);
  for (const channel of sourceChannels) {
    try {
      const parent = channel.parentId ? categoryMap.get(channel.parentId) : null;

      const options = {
        name: channel.name,
        type: channel.type,
        ...(parent ? { parent: parent.id } : {}),
        permissionOverwrites: buildOverwrites(channel, roleMap, target.id, source.id),
        reason: 'Server clone: channel',
      };

      // Type-specific extras (guarded so unsupported props are simply omitted).
      if (typeof channel.topic === 'string') options.topic = channel.topic;
      if (typeof channel.nsfw === 'boolean') options.nsfw = channel.nsfw;
      if (typeof channel.rateLimitPerUser === 'number') {
        options.rateLimitPerUser = channel.rateLimitPerUser;
      }
      if (typeof channel.bitrate === 'number') options.bitrate = channel.bitrate;
      if (typeof channel.userLimit === 'number') options.userLimit = channel.userLimit;
      if (channel.rtcRegion) options.rtcRegion = channel.rtcRegion;

      await target.channels.create(options);
      summary.channels += 1;

      // Be gentle with the API on very large servers.
      await sleep(250);
    } catch (err) {
      summary.skipped.push(`Channel "${channel.name}" (${err.message})`);
    }
  }

  return summary;
}

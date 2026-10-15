export const ROLES = ['super_admin', 'admin', 'editor', 'translator', 'moderator', 'viewer', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'admin.access',
  'content.read', 'content.create', 'content.update', 'content.publish', 'content.archive',
  'subtitles.read', 'subtitles.create', 'subtitles.update', 'subtitles.verify', 'subtitles.delete',
  'media.read', 'media.upload', 'media.update', 'media.delete',
  'users.read', 'users.update', 'users.roles',
  'moderation.read', 'moderation.update',
  'homepage.read', 'homepage.update',
  'taxonomy.read', 'taxonomy.update',
  'analytics.read', 'settings.read', 'settings.update', 'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function canPublishSubtitle(permissions: readonly Permission[]) {
  return permissions.includes('subtitles.update') && permissions.includes('subtitles.verify');
}

export function canEditSubtitle(permissions: readonly Permission[], status: string) {
  return permissions.includes('subtitles.update') && (status !== 'published' || permissions.includes('subtitles.verify'));
}

export function canDeleteSubtitle(permissions: readonly Permission[]) {
  return permissions.includes('subtitles.delete');
}

export function canPublishMovie(permissions: readonly Permission[]) {
  return permissions.includes('content.update') && permissions.includes('content.publish');
}

export function canArchiveMovie(permissions: readonly Permission[]) {
  return permissions.includes('content.archive');
}

const allPermissions = [...PERMISSIONS];
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: allPermissions,
  admin: allPermissions.filter((permission) => permission !== 'users.roles'),
  editor: ['admin.access', 'content.read', 'content.create', 'content.update', 'content.publish', 'content.archive', 'subtitles.read', 'subtitles.create', 'subtitles.update', 'media.read', 'media.upload', 'homepage.read', 'homepage.update', 'taxonomy.read', 'taxonomy.update', 'analytics.read'],
  translator: ['admin.access', 'content.read', 'subtitles.read', 'subtitles.create', 'subtitles.update', 'media.read'],
  moderator: ['admin.access', 'content.read', 'subtitles.read', 'users.read', 'moderation.read', 'moderation.update'],
  viewer: ['admin.access', 'content.read', 'subtitles.read', 'media.read', 'homepage.read', 'taxonomy.read', 'analytics.read', 'settings.read', 'audit.read'],
  user: [],
};

export type AuthUser = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  role: Role;
  permissions: Permission[];
  avatarUrl?: string;
  locale: 'en' | 'si';
};

export type AuthSession = {
  id: string;
  csrfHash: string;
  expiresAt: Date;
  user: AuthUser;
};

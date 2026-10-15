import { describe, expect, it } from 'vitest';
import { canDeleteSubtitle, canEditSubtitle, canPublishSubtitle, ROLE_PERMISSIONS } from '../src/types/auth';

describe('role permissions', () => {
  it('keeps public users outside the admin boundary', () => {
    expect(ROLE_PERMISSIONS.user).toEqual([]);
    expect(ROLE_PERMISSIONS.viewer).toContain('admin.access');
  });

  it('limits translators to content visibility and subtitle work', () => {
    expect(ROLE_PERMISSIONS.translator).toContain('subtitles.create');
    expect(ROLE_PERMISSIONS.translator).not.toContain('settings.update');
    expect(ROLE_PERMISSIONS.translator).not.toContain('users.roles');
    expect(ROLE_PERMISSIONS.translator).not.toContain('media.upload');
  });

  it('reserves role assignment for super administrators', () => {
    expect(ROLE_PERMISSIONS.super_admin).toContain('users.roles');
    expect(ROLE_PERMISSIONS.admin).not.toContain('users.roles');
    expect(ROLE_PERMISSIONS.moderator).toContain('moderation.update');
    expect(ROLE_PERMISSIONS.moderator).not.toContain('settings.update');
  });

  it('shows subtitle publishing only when update and verification permissions are both present', () => {
    expect(canPublishSubtitle(ROLE_PERMISSIONS.admin)).toBe(true);
    expect(canPublishSubtitle(ROLE_PERMISSIONS.editor)).toBe(false);
    expect(canPublishSubtitle(['subtitles.update'])).toBe(false);
    expect(canPublishSubtitle(['subtitles.verify'])).toBe(false);
    expect(canPublishSubtitle(['subtitles.update', 'subtitles.verify'])).toBe(true);
  });

  it('requires verification permission before editing an already-published subtitle', () => {
    expect(canEditSubtitle(ROLE_PERMISSIONS.editor, 'draft')).toBe(true);
    expect(canEditSubtitle(ROLE_PERMISSIONS.editor, 'published')).toBe(false);
    expect(canEditSubtitle(ROLE_PERMISSIONS.admin, 'published')).toBe(true);
    expect(canEditSubtitle(ROLE_PERMISSIONS.viewer, 'draft')).toBe(false);
  });

  it('shows subtitle deletion only to users with the dedicated delete permission', () => {
    expect(canDeleteSubtitle(ROLE_PERMISSIONS.admin)).toBe(true);
    expect(canDeleteSubtitle(ROLE_PERMISSIONS.editor)).toBe(false);
    expect(canDeleteSubtitle(['subtitles.update', 'subtitles.verify'])).toBe(false);
    expect(canDeleteSubtitle(['subtitles.delete'])).toBe(true);
  });

  it('limits advertising configuration writes to settings administrators', () => {
    expect(ROLE_PERMISSIONS.super_admin).toContain('settings.update');
    expect(ROLE_PERMISSIONS.admin).toContain('settings.update');
    expect(ROLE_PERMISSIONS.editor).not.toContain('settings.update');
    expect(ROLE_PERMISSIONS.translator).not.toContain('settings.update');
    expect(ROLE_PERMISSIONS.viewer).not.toContain('settings.update');
  });
});

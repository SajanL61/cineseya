import { describe, expect, it } from 'vitest';
import { subtitlePublishedEventKey, uniqueRecipientIds } from '@/services/notifications';
import { Notification, SubtitleRequest, SubtitleSubscription } from '@/models';

describe('subtitle notification foundation', () => {
  it('deduplicates requesters and subscribers before delivery', () => {
    expect(uniqueRecipientIds([{ user: 'a' }, { user: 'b' }], [{ user: 'b' }, { user: 'c' }])).toEqual(['a', 'b', 'c']);
  });

  it('uses a stable per-publication idempotency key', () => {
    expect(subtitlePublishedEventKey('subtitle-id')).toBe('subtitle:subtitle-id:published');
  });

  it('enforces one subscription and request per user/content/language tuple', () => {
    for (const model of [SubtitleSubscription, SubtitleRequest]) {
      const match = model.schema.indexes().find(([fields, options]) => options.unique && Object.keys(fields).join(',') === 'user,contentType,contentId,languageCode');
      expect(match).toBeTruthy();
    }
  });

  it('enforces idempotent notification creation per user and event', () => {
    const match = Notification.schema.indexes().find(([fields, options]) => options.unique && Object.keys(fields).join(',') === 'user,eventKey');
    expect(match).toBeTruthy();
  });
});

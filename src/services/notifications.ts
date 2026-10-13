import 'server-only';
import { connectDb } from '@/lib/db';
import { Episode, Movie, Notification, NotificationPreference, Series, Subtitle, SubtitleRequest, SubtitleSubscription } from '@/models';

type Channel = 'in_app' | 'web_push' | 'email' | 'telegram';

export function subtitlePublishedEventKey(subtitleId: string) {
  return `subtitle:${subtitleId}:published`;
}

export function uniqueRecipientIds(...groups: Array<unknown[]>) {
  return [...new Set(groups.flatMap((group) => group.map((item) => String((item as { user?: unknown })?.user ?? '')).filter(Boolean)))];
}

export async function publishSubtitleNotifications(subtitleId: string) {
  await connectDb();
  const subtitle = await Subtitle.findById(subtitleId).select('movie episode language languageCode status').lean();
  if (!subtitle || subtitle.status !== 'published') return { recipients: 0, notifications: 0 };
  const contentType = subtitle.movie ? 'movie' : subtitle.episode ? 'episode' : null;
  const contentId = subtitle.movie ?? subtitle.episode;
  if (!contentType || !contentId) return { recipients: 0, notifications: 0 };
  const filter = { contentType, contentId, languageCode: String(subtitle.languageCode).toLocaleLowerCase() };
  const [subscriptions, requests] = await Promise.all([
    SubtitleSubscription.find(filter).select('user').lean(),
    SubtitleRequest.find({ ...filter, status: 'open' }).select('user').lean(),
  ]);
  const recipientIds = uniqueRecipientIds(subscriptions, requests);
  let title = 'Subtitle update';
  let href = '/subtitles';
  if (contentType === 'movie') {
    const movie = await Movie.findById(contentId).select('title slug').lean();
    if (movie) { title = String(movie.title); href = `/movies/${movie.slug}#subtitles`; }
  } else {
    const episode = await Episode.findById(contentId).select('title series seasonNumber episodeNumber').lean();
    const series = episode ? await Series.findById(episode.series).select('title slug').lean() : null;
    if (episode && series) { title = `${series.title} — S${episode.seasonNumber} E${episode.episodeNumber}`; href = `/tv/${series.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}#subtitles`; }
  }
  const preferences = recipientIds.length ? await NotificationPreference.find({ user: { $in: recipientIds } }).select('user subtitlePublished').lean() : [];
  const preferenceByUser = new Map(preferences.map((item) => [String(item.user), item.subtitlePublished as Record<string, boolean> | undefined]));
  const eventKey = subtitlePublishedEventKey(subtitleId);
  const operations = recipientIds.flatMap((userId) => {
    const preference = preferenceByUser.get(userId);
    if (preference?.inApp === false) return [];
    const channels: Channel[] = ['in_app'];
    if (preference?.webPush) channels.push('web_push');
    if (preference?.email) channels.push('email');
    if (preference?.telegram) channels.push('telegram');
    return [{ updateOne: { filter: { user: userId, eventKey }, update: { $setOnInsert: {
      user: userId, type: 'subtitle_published', category: 'subtitle_published', eventKey, channels,
      delivery: { inApp: 'delivered', webPush: channels.includes('web_push') ? 'pending_configuration' : 'disabled', email: channels.includes('email') ? 'pending_configuration' : 'disabled', telegram: channels.includes('telegram') ? 'pending_configuration' : 'disabled' },
      payload: { message: `${subtitle.language} subtitles are now available for ${title}.`, title, href, contentType, contentId: String(contentId), subtitleId },
    } }, upsert: true } }];
  });
  const result = operations.length ? await Notification.bulkWrite(operations, { ordered: false }) : null;
  await SubtitleRequest.updateMany({ ...filter, status: 'open' }, { $set: { status: 'fulfilled', fulfilledAt: new Date(), fulfilledBySubtitle: subtitle._id } });
  return { recipients: recipientIds.length, notifications: result?.upsertedCount ?? 0 };
}

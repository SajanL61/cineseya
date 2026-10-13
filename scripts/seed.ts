import mongoose, { Types } from 'mongoose';
import { connectDb } from '@/lib/db';
import { demoMovies, demoSeries, demoSubtitles, demoTranslators } from '@/data/demo';
import { ensureCineSeyaIndexes, Episode, Genre, HomepageSection, Language, Movie, Season, Series, SiteSetting, Subtitle, TranslatorProfile } from '@/models';

const genres = [...new Set([...demoMovies.flatMap((movie) => movie.genres), ...demoSeries.flatMap((series) => series.genres)])];
const languages = [...new Set([...demoMovies.flatMap((movie) => movie.languages), ...demoMovies.flatMap((movie) => movie.subtitleLanguages), ...demoSeries.flatMap((series) => series.languages)])];

try {
  await connectDb();
  for (const movie of demoMovies) {
    const { id, ...record } = movie;
    await Movie.updateOne({ _id: new Types.ObjectId(id) }, { $set: { ...record, releaseDate: new Date(record.releaseDate), publishedAt: new Date(), publicationStatus: 'published' } }, { upsert: true });
  }
  for (const translator of demoTranslators) {
    const record = { ...translator } as Record<string, unknown>;
    delete record.id; delete record.joinedAt;
    await TranslatorProfile.updateOne({ _id: new Types.ObjectId(translator.id) }, { $set: record }, { upsert: true });
  }
  for (const series of demoSeries) {
    const { id, seasons, ...seriesRecord } = series;
    const seriesId = new Types.ObjectId(id);
    await Series.updateOne({ _id: seriesId }, { $set: { ...seriesRecord, publicationStatus: 'published', publishedAt: new Date() } }, { upsert: true });
    for (const season of seasons) {
      const seasonId = new Types.ObjectId(season.id);
      await Season.updateOne({ _id: seasonId }, { $set: { series: seriesId, seasonNumber: season.seasonNumber, title: season.title, publicationStatus: 'published' } }, { upsert: true });
      for (const episode of season.episodes) {
        const { id: episodeId, ...episodeRecord } = episode;
        await Episode.updateOne({ _id: new Types.ObjectId(episodeId) }, { $set: { ...episodeRecord, series: seriesId, season: seasonId, releaseDate: new Date(episode.releaseDate), publicationStatus: 'published' } }, { upsert: true });
      }
    }
  }
  for (const subtitle of demoSubtitles) {
    const record = { ...subtitle } as Record<string, unknown>;
    for (const key of ['id','movieId','seriesId','episodeId','translatorId','contentSlug','contentTitle','contentPosterUrl','translatorName','translatorSlug','translatorAvatarUrl']) delete record[key];
    await Subtitle.updateOne({ _id: new Types.ObjectId(subtitle.id) }, { $set: { ...record, movie: subtitle.movieId ? new Types.ObjectId(subtitle.movieId) : undefined, series: subtitle.seriesId ? new Types.ObjectId(subtitle.seriesId) : undefined, episode: subtitle.episodeId ? new Types.ObjectId(subtitle.episodeId) : undefined, translator: new Types.ObjectId(subtitle.translatorId), fileKey: `pending-seed/${subtitle.fileName}`, status: 'draft', verified: false, createdAt: new Date(subtitle.createdAt), updatedAt: new Date(subtitle.updatedAt) } }, { upsert: true });
  }
  for (const [index, name] of genres.entries()) await Genre.updateOne({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g,'-') }, { $set: { name, visible: true, displayOrder: index } }, { upsert: true });
  for (const [index, name] of languages.entries()) await Language.updateOne({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g,'-') }, { $set: { name, visible: true, displayOrder: index } }, { upsert: true });
  const sections = [
    ['hero','Featured presentation','hero',0],['trending','Trending now','movie_row',10],['latest-subtitles','Latest Sinhala subtitles','subtitle_row',20],
    ['new-releases','New releases','movie_row',30],['top-rated','Top rated','movie_row',40],['latest-tv','Latest TV episodes','episode_row',50],['editors-picks',"Editors' picks",'movie_row',60],
  ] as const;
  for (const [key,title,type,displayOrder] of sections) await HomepageSection.updateOne({ key }, { $set: { title, type, displayOrder, enabled: true } }, { upsert: true });
  await SiteSetting.updateOne({ key: 'catalog.seedVersion' }, { $set: { value: '2026-10-cineseya-v1' } }, { upsert: true });
  await ensureCineSeyaIndexes();
  process.stdout.write(`Seeded ${demoMovies.length} movies, ${demoSeries.length} series, ${demoTranslators.length} translators and ${demoSubtitles.length} draft subtitle records into cinerusubs.\n`);
} finally { await mongoose.disconnect(); }

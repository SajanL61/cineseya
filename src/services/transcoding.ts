import 'server-only';
import { randomUUID } from 'node:crypto';
import mongoose, { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import { assertMediaDistributionAllowed } from '@/lib/rights';
import { AuditLog, Episode, MediaAsset, MediaStream, Movie, TranscodeJob, WorkerHeartbeat } from '@/models';
import type { RightsStatus } from '@/types/content';
import type { SourceProbe, StreamingRendition } from '@/types/streaming';
import { buildAtomicClaim, buildTranscodeDedupeKey, transcodeCanCancel, transcodeFailureState } from '@/lib/transcoding';

const STALE_LOCK_MS = 15 * 60_000;

type CreateJobInput = {
  assetId: string;
  contentId: string;
  contentType: 'movie' | 'episode';
  requestedRenditions: string[];
  language?: string;
  defaultAudio?: string;
  subtitleHandling: 'separate' | 'ignore';
  notes?: string;
  keepMaster: boolean;
  force: boolean;
};

export async function createTranscodeJob(input: CreateJobInput, userId: string) {
  if (!isValidObjectId(input.assetId) || !isValidObjectId(input.contentId)) throw Object.assign(new Error('Master asset or content was not found.'), { status: 404, code: 'NOT_FOUND' });
  await connectDb();
  const [asset, content] = await Promise.all([
    MediaAsset.findOne({ _id: input.assetId, kind: 'media', status: 'active' }),
    input.contentType === 'movie' ? Movie.findById(input.contentId) : Episode.findById(input.contentId),
  ]);
  if (!asset || !content) throw Object.assign(new Error('Master asset or content was not found.'), { status: 404, code: 'NOT_FOUND' });
  if (String((asset.metadata as Record<string, unknown> | undefined)?.purpose) !== 'stream_master') {
    throw Object.assign(new Error('Choose an upload created as a streaming master.'), { status: 409, code: 'NOT_A_STREAM_MASTER' });
  }
  assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
  const baseDedupeKey = buildTranscodeDedupeKey(String(asset._id), env.TRANSCODE_PROFILE_VERSION);
  if (!input.force) {
    const existing = await TranscodeJob.findOne({ dedupeKey: baseDedupeKey }).lean();
    if (existing) return { id: String(existing._id), streamId: String(existing.stream), status: String(existing.status), existing: true };
  }

  const streamId = new mongoose.Types.ObjectId();
  const prefix = `streams/${input.contentType === 'movie' ? 'movies' : 'episodes'}/${input.contentId}/${streamId}`;
  const dedupeKey = input.force ? buildTranscodeDedupeKey(String(asset._id), env.TRANSCODE_PROFILE_VERSION, randomUUID()) : baseDedupeKey;
  const stream = await MediaStream.create({
    _id: streamId, contentId: input.contentId, contentType: input.contentType, masterAsset: asset._id,
    profileVersion: env.TRANSCODE_PROFILE_VERSION, status: 'processing', prefix, renditions: [], rightsStatus: content.rightsStatus,
    active: false, createdBy: userId, updatedBy: userId,
  });
  try {
    const job = await TranscodeJob.create({
      contentType: input.contentType, contentId: input.contentId, masterAsset: asset._id, masterObjectKey: asset.objectKey,
      stream: stream._id, dedupeKey, profileVersion: env.TRANSCODE_PROFILE_VERSION, requestedRenditions: input.requestedRenditions,
      language: input.language, defaultAudio: input.defaultAudio, subtitleHandling: input.subtitleHandling, notes: input.notes,
      keepMaster: input.keepMaster, createdBy: userId,
    });
    asset.linkedModel = input.contentType === 'movie' ? 'Movie' : 'Episode';
    asset.linkedId = input.contentId;
    await asset.save();
    await AuditLog.create({ actor: userId, action: 'transcode.queue', entity: 'TranscodeJob', entityId: String(job._id), metadata: { contentId: input.contentId, masterAsset: input.assetId, profileVersion: env.TRANSCODE_PROFILE_VERSION, requestedRenditions: input.requestedRenditions } });
    return { id: String(job._id), streamId: String(stream._id), status: 'queued', existing: false };
  } catch (error) {
    await MediaStream.deleteOne({ _id: stream._id }).catch(() => undefined);
    throw error;
  }
}

export async function claimNextTranscodeJob(workerId: string) {
  await connectDb();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  const exhausted = await TranscodeJob.find({ status: { $in: ['processing', 'uploading'] }, lockedAt: { $lt: staleBefore }, attempts: { $gte: env.TRANSCODE_MAX_ATTEMPTS } }).select('_id stream').lean();
  if (exhausted.length) {
    await Promise.all([
      TranscodeJob.updateMany({ _id: { $in: exhausted.map((job) => job._id) } }, { $set: { status: 'failed', currentStage: 'failed_stale_lock', failedAt: new Date(), errorCode: 'STALE_WORKER_LOCK', safeErrorMessage: 'Video processing stopped unexpectedly.' }, $unset: { workerId: 1, lockedAt: 1 } }),
      MediaStream.updateMany({ _id: { $in: exhausted.map((job) => job.stream) } }, { $set: { status: 'failed', active: false } }),
    ]);
  }
  await TranscodeJob.updateMany(
    { status: { $in: ['processing', 'uploading'] }, lockedAt: { $lt: staleBefore }, attempts: { $lt: env.TRANSCODE_MAX_ATTEMPTS }, cancellationRequestedAt: { $exists: false } },
    { $set: { status: 'queued', currentStage: 'recovered_stale_lock' }, $unset: { workerId: 1, lockedAt: 1 } },
  );
  const claim = buildAtomicClaim(workerId, new Date(), env.TRANSCODE_MAX_ATTEMPTS);
  return TranscodeJob.findOneAndUpdate(claim.filter, claim.update, claim.options);
}

export async function updateTranscodeProgress(jobId: string, stage: string, progressPercent: number, source?: SourceProbe) {
  const progress = Math.max(0, Math.min(99, Math.round(progressPercent)));
  const job = await TranscodeJob.findOneAndUpdate({ _id: jobId, status: { $in: ['processing', 'uploading'] } }, {
    $set: { currentStage: stage, progressPercent: progress, lockedAt: new Date(), ...(source ? { source } : {}) },
  }, { new: true }).select('workerId');
  if (job?.workerId) await WorkerHeartbeat.updateOne({ workerId: String(job.workerId).split(':')[0] }, { $set: { status: 'busy', currentJob: job._id, progressPercent: progress, lastHeartbeatAt: new Date() } });
}

export async function markTranscodeUploading(jobId: string) {
  await TranscodeJob.updateOne({ _id: jobId, status: 'processing' }, { $set: { status: 'uploading', currentStage: 'uploading_hls', progressPercent: 92, lockedAt: new Date() } });
}

export async function completeTranscodeJob(jobId: string, input: { source: SourceProbe; manifestKey: string; renditions: StreamingRendition[]; totalBytes: number; segmentCount: number }) {
  const job = await TranscodeJob.findById(jobId);
  if (!job) throw new Error('Transcode job disappeared before completion.');
  await MediaStream.updateOne({ _id: job.stream }, { $set: {
    status: 'ready', manifestKey: input.manifestKey, renditions: input.renditions, source: input.source,
    totalBytes: input.totalBytes, segmentCount: input.segmentCount, active: true, verifiedAt: new Date(), updatedBy: job.createdBy,
  } });
  await TranscodeJob.updateOne({ _id: jobId }, { $set: {
    status: 'completed', source: input.source, completedRenditions: input.renditions, progressPercent: 100,
    currentStage: 'completed', completedAt: new Date(), lockedAt: new Date(),
  } });
}

export async function failTranscodeJob(jobId: string, code: string, safeMessage = 'Video processing failed.') {
  const job = await TranscodeJob.findById(jobId).select('attempts stream cancellationRequestedAt');
  if (!job) return;
  const nextState = transcodeFailureState(Number(job.attempts), env.TRANSCODE_MAX_ATTEMPTS, Boolean(job.cancellationRequestedAt));
  if (nextState === 'cancelled') {
    await TranscodeJob.updateOne({ _id: jobId }, { $set: { status: 'cancelled', currentStage: 'cancelled', failedAt: new Date(), safeErrorMessage: 'Processing was cancelled.' }, $unset: { workerId: 1, lockedAt: 1 } });
    await MediaStream.updateOne({ _id: job.stream }, { $set: { status: 'failed', active: false } });
    return;
  }
  const retry = nextState === 'queued';
  await TranscodeJob.updateOne({ _id: jobId }, retry ? {
    $set: { status: 'queued', currentStage: 'retry_queued', errorCode: code, safeErrorMessage: safeMessage }, $unset: { workerId: 1, lockedAt: 1 },
  } : {
    $set: { status: 'failed', currentStage: 'failed', failedAt: new Date(), errorCode: code, safeErrorMessage: safeMessage }, $unset: { workerId: 1, lockedAt: 1 },
  });
  if (!retry) await MediaStream.updateOne({ _id: job.stream }, { $set: { status: 'failed', active: false } });
}

export async function transcodeCancellationRequested(jobId: string) {
  const row = await TranscodeJob.findById(jobId).select('cancellationRequestedAt status').lean();
  return Boolean(row?.cancellationRequestedAt || row?.status === 'cancelled');
}

export async function heartbeatWorker(workerId: string, status: 'online' | 'busy' | 'stopping', currentJob?: string, progressPercent?: number) {
  await connectDb();
  await WorkerHeartbeat.updateOne({ workerId }, { $set: { status, currentJob: currentJob || undefined, progressPercent, version: env.TRANSCODE_PROFILE_VERSION, lastHeartbeatAt: new Date() } }, { upsert: true });
}

export async function requestTranscodeJobAction(jobId: string, action: 'retry' | 'cancel' | 'reprocess', userId: string) {
  if (!isValidObjectId(jobId)) throw Object.assign(new Error('Transcode job was not found.'), { status: 404, code: 'NOT_FOUND' });
  await connectDb();
  const job = await TranscodeJob.findById(jobId);
  if (!job) throw Object.assign(new Error('Transcode job was not found.'), { status: 404, code: 'NOT_FOUND' });
  if (action === 'reprocess') {
    if (job.status !== 'completed') throw Object.assign(new Error('Only completed jobs can be reprocessed.'), { status: 409, code: 'INVALID_JOB_STATE' });
    await createTranscodeJob({
      assetId: String(job.masterAsset), contentId: String(job.contentId), contentType: job.contentType as 'movie' | 'episode',
      requestedRenditions: Array.isArray(job.requestedRenditions) ? job.requestedRenditions.map(String) : [],
      language: job.language ? String(job.language) : undefined, defaultAudio: job.defaultAudio ? String(job.defaultAudio) : undefined,
      subtitleHandling: job.subtitleHandling === 'ignore' ? 'ignore' : 'separate', notes: job.notes ? String(job.notes) : undefined,
      keepMaster: job.keepMaster !== false, force: true,
    }, userId);
    return;
  }
  if (action === 'cancel') {
    if (!transcodeCanCancel(String(job.status))) throw Object.assign(new Error('Only active jobs can be cancelled.'), { status: 409, code: 'INVALID_JOB_STATE' });
    if (job.status === 'queued') { job.status = 'cancelled'; job.currentStage = 'cancelled'; }
    job.cancellationRequestedAt = new Date();
  } else {
    if (!['failed', 'cancelled'].includes(String(job.status))) throw Object.assign(new Error('Only failed or cancelled jobs can be retried.'), { status: 409, code: 'INVALID_JOB_STATE' });
    job.status = 'queued'; job.currentStage = 'queued'; job.progressPercent = 0; job.attempts = 0; job.cancellationRequestedAt = undefined;
    await MediaStream.updateOne({ _id: job.stream }, { $set: { status: 'processing', active: false } });
  }
  await job.save();
  await AuditLog.create({ actor: userId, action: `transcode.${action}`, entity: 'TranscodeJob', entityId: jobId });
}

export async function getAdminTranscodeDashboard() {
  await connectDb();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [queued, processing, failed, completedToday, jobs, heartbeat] = await Promise.all([
    TranscodeJob.countDocuments({ status: 'queued' }),
    TranscodeJob.countDocuments({ status: { $in: ['processing', 'uploading'] } }),
    TranscodeJob.countDocuments({ status: 'failed' }),
    TranscodeJob.countDocuments({ status: 'completed', completedAt: { $gte: today } }),
    TranscodeJob.find().sort({ createdAt: -1 }).limit(50).lean(),
    WorkerHeartbeat.findOne().sort({ lastHeartbeatAt: -1 }).lean(),
  ]);
  const contentIds = jobs.map((job) => job.contentId);
  const movies = await Movie.find({ _id: { $in: contentIds } }).select('title').lean();
  const titles = new Map(movies.map((movie) => [String(movie._id), String(movie.title)]));
  return {
    counts: { queued, processing, failed, completedToday },
    workerOnline: Boolean(heartbeat?.lastHeartbeatAt && Date.now() - new Date(heartbeat.lastHeartbeatAt as Date).getTime() < 90_000),
    worker: heartbeat ? JSON.parse(JSON.stringify(heartbeat)) as Record<string, unknown> : null,
    jobs: jobs.map((job) => {
      const progress = Number(job.progressPercent || 0); const started = job.startedAt ? new Date(job.startedAt as Date).getTime() : 0;
      const etaSeconds = started && progress > 1 && progress < 100 ? Math.max(0, Math.round(((Date.now() - started) / (progress / 100) - (Date.now() - started)) / 1_000)) : undefined;
      return { ...JSON.parse(JSON.stringify(job)) as Record<string, unknown>, title: titles.get(String(job.contentId)) || 'Episode or removed title', etaSeconds };
    }),
  };
}

export async function getAdminTranscodeJobsForContent(contentId: string, contentType: 'movie' | 'episode') {
  if (!isValidObjectId(contentId)) return [];
  await connectDb();
  const jobs = await TranscodeJob.find({ contentId, contentType }).select('-masterObjectKey -dedupeKey').sort({ createdAt: -1 }).limit(10).lean();
  return jobs.map((job) => JSON.parse(JSON.stringify(job)) as Record<string, unknown>);
}

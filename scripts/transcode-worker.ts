import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { env } from '@/lib/env';
import { deleteObjectPrefix, downloadObjectFile, inspectObject, uploadObjectFile } from '@/lib/r2';
import { buildMasterPlaylist, hlsContentType, parseFfprobe, selectTranscodeProfiles } from '@/lib/transcoding';
import {
  claimNextTranscodeJob, completeTranscodeJob, failTranscodeJob, heartbeatWorker, markTranscodeUploading,
  transcodeCancellationRequested, updateTranscodeProgress,
} from '@/services/transcoding';
import type { SourceProbe, StreamingRendition } from '@/types/streaming';

const workerId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;
let activeChild: ChildProcess | null = null;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const safeLog = (event: string, metadata: Record<string, unknown> = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), workerId, event, ...metadata }));

async function runCapture(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { if (stdout.length < 5_000_000) stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { if (stderr.length < 20_000) stderr += String(chunk); });
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve(stdout) : reject(Object.assign(new Error(`${command} exited with code ${code}: ${stderr.slice(-1_000)}`), { code: `${command.toUpperCase()}_FAILED` })));
  });
}

async function probeSource(filePath: string) {
  const output = await runCapture('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath]);
  return parseFfprobe(JSON.parse(output));
}

async function runFfmpeg(args: string[], input: { jobId: string; source: SourceProbe; baseProgress: number; span: number }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    activeChild = child;
    let buffer = ''; let stderr = ''; let lastWrite = 0; let settled = false;
    const cancellation = setInterval(() => {
      void transcodeCancellationRequested(input.jobId).then((cancelled) => { if (cancelled || stopping) child.kill('SIGTERM'); }).catch(() => undefined);
    }, 2_000);
    child.stdout.on('data', (chunk) => {
      buffer += String(chunk);
      const lines = buffer.split(/\r?\n/); buffer = lines.pop() || '';
      for (const line of lines) {
        const match = /^out_time_(?:ms|us)=(\d+)$/.exec(line);
        if (!match) continue;
        const seconds = Number(match[1]) / 1_000_000;
        const now = Date.now();
        if (now - lastWrite >= 3_000) {
          lastWrite = now;
          const ratio = Math.max(0, Math.min(1, seconds / input.source.duration));
          void updateTranscodeProgress(input.jobId, 'transcoding', input.baseProgress + ratio * input.span).catch(() => undefined);
        }
      }
    });
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-20_000); });
    child.once('error', (error) => { if (!settled) { settled = true; clearInterval(cancellation); activeChild = null; reject(error); } });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true; clearInterval(cancellation); activeChild = null;
      if (code === 0) resolve();
      else reject(Object.assign(new Error(`FFmpeg stopped (${signal || code}): ${stderr.slice(-1_000)}`), { code: signal ? 'TRANSCODE_CANCELLED' : 'FFMPEG_FAILED' }));
    });
  });
}

async function listFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

async function createRendition(inputPath: string, outputRoot: string, profile: ReturnType<typeof selectTranscodeProfiles>[number], source: SourceProbe, jobId: string, index: number, count: number) {
  const directory = path.join(outputRoot, profile.name);
  await mkdir(directory, { recursive: true });
  const segmentSeconds = env.TRANSCODE_SEGMENT_SECONDS;
  const frameRate = Math.max(1, Math.round(source.frameRate));
  const gop = frameRate * segmentSeconds;
  const playlist = path.join(directory, 'index.m3u8');
  const segmentPattern = path.join(directory, 'segment%05d.ts');
  const scale = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`;
  const args = [
    '-hide_banner', '-nostdin', '-y', '-i', inputPath, '-map', '0:v:0', '-map', '0:a:0?', '-vf', scale,
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', String(profile.videoBitrate),
    '-maxrate', String(Math.round(profile.videoBitrate * 1.07)), '-bufsize', String(Math.round(profile.videoBitrate * 1.5)),
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-force_key_frames', `expr:gte(t,n_forced*${segmentSeconds})`,
    '-c:a', 'aac', '-b:a', String(profile.audioBitrate), '-ac', '2', '-ar', '48000', '-sn',
    '-hls_time', String(segmentSeconds), '-hls_playlist_type', 'vod', '-hls_segment_type', 'mpegts', '-hls_flags', 'independent_segments',
    '-hls_segment_filename', segmentPattern, '-progress', 'pipe:1', '-nostats', playlist,
  ];
  await runFfmpeg(args, { jobId, source, baseProgress: 10 + (index / count) * 78, span: 78 / count });
  const files = await listFiles(directory);
  const segments = files.filter((file) => file.endsWith('.ts'));
  if (!(await stat(playlist)).size || !segments.length) throw Object.assign(new Error('FFmpeg did not create a valid HLS rendition.'), { code: 'INVALID_HLS_OUTPUT' });
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  const hasAudio = source.audioStreams.length > 0;
  const averageBandwidth = profile.videoBitrate + (hasAudio ? profile.audioBitrate : 0);
  return {
    name: profile.name, width: profile.width, height: profile.height, videoBitrate: profile.videoBitrate,
    audioBitrate: hasAudio ? profile.audioBitrate : 0, bandwidth: Math.round(profile.videoBitrate * 1.07) + (hasAudio ? profile.audioBitrate : 0),
    averageBandwidth, codecs: hasAudio ? 'avc1.4d401f,mp4a.40.2' : 'avc1.4d401f', playlistKey: '', segmentCount: segments.length, bytes,
  } satisfies StreamingRendition;
}

async function processJob(job: Record<string, unknown>) {
  const jobId = String(job._id); const streamId = String(job.stream); const prefix = `streams/${job.contentType === 'movie' ? 'movies' : 'episodes'}/${job.contentId}/${streamId}`;
  const workDirectory = path.join(env.TRANSCODE_TEMP_DIR, `${jobId}-${randomUUID()}`);
  const inputDirectory = path.join(workDirectory, 'input'); const outputDirectory = path.join(workDirectory, 'output');
  const sourceName = path.basename(String(job.masterObjectKey)).replace(/^original-/, '') || 'master.bin';
  const inputPath = path.join(inputDirectory, sourceName);
  safeLog('job_started', { jobId, contentId: String(job.contentId) });
  try {
    await mkdir(inputDirectory, { recursive: true }); await mkdir(outputDirectory, { recursive: true });
    await downloadObjectFile(String(job.masterObjectKey), inputPath, 'media');
    if (await transcodeCancellationRequested(jobId)) throw Object.assign(new Error('Job cancelled.'), { code: 'TRANSCODE_CANCELLED' });
    await updateTranscodeProgress(jobId, 'analyzing_source', 4);
    const source = await probeSource(inputPath);
    await updateTranscodeProgress(jobId, 'selecting_renditions', 8, source);
    const profiles = selectTranscodeProfiles(source, Array.isArray(job.requestedRenditions) ? job.requestedRenditions.map(String) : undefined);
    const renditions: StreamingRendition[] = [];
    for (let index = 0; index < profiles.length; index++) {
      const profile = profiles[index]!;
      await updateTranscodeProgress(jobId, `generating_${profile.name}`, 10 + (index / profiles.length) * 78);
      const rendition = await createRendition(inputPath, outputDirectory, profile, source, jobId, index, profiles.length);
      rendition.playlistKey = `${prefix}/${profile.name}/index.m3u8`;
      renditions.push(rendition);
    }
    await writeFile(path.join(outputDirectory, 'master.m3u8'), buildMasterPlaylist(renditions), 'utf8');
    if (await transcodeCancellationRequested(jobId)) throw Object.assign(new Error('Job cancelled.'), { code: 'TRANSCODE_CANCELLED' });
    await markTranscodeUploading(jobId);
    const files = await listFiles(outputDirectory); let uploadedBytes = 0;
    for (let index = 0; index < files.length; index++) {
      if ((index % 10 === 0 && await transcodeCancellationRequested(jobId)) || stopping) throw Object.assign(new Error('Job cancelled.'), { code: 'TRANSCODE_CANCELLED' });
      const file = files[index]!;
      const relative = path.relative(outputDirectory, file).split(path.sep).join('/');
      uploadedBytes += await uploadObjectFile(`${prefix}/${relative}`, file, hlsContentType(relative), 'media');
      if (index % 10 === 0) await updateTranscodeProgress(jobId, 'uploading_hls', 92 + (index / files.length) * 6);
    }
    if (await transcodeCancellationRequested(jobId)) throw Object.assign(new Error('Job cancelled.'), { code: 'TRANSCODE_CANCELLED' });
    const manifestKey = `${prefix}/master.m3u8`;
    const manifest = await inspectObject(manifestKey, 'media');
    if (!manifest.ContentLength) throw Object.assign(new Error('Uploaded HLS manifest could not be verified.'), { code: 'HLS_VERIFY_FAILED' });
    await completeTranscodeJob(jobId, { source, manifestKey, renditions, totalBytes: uploadedBytes, segmentCount: renditions.reduce((sum, item) => sum + item.segmentCount, 0) });
    safeLog('job_completed', { jobId, renditions: renditions.map((item) => item.name), bytes: uploadedBytes });
  } catch (error) {
    await deleteObjectPrefix(`${prefix}/`, 'media').catch(() => undefined);
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'TRANSCODE_FAILED';
    safeLog('job_failed', { jobId, code });
    await failTranscodeJob(jobId, code, code === 'TRANSCODE_CANCELLED' ? 'Processing was cancelled.' : 'Video processing failed.');
  } finally {
    await rm(workDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function workerLoop(slot: number) {
  while (!stopping) {
    try {
      const job = await claimNextTranscodeJob(`${workerId}:${slot}`);
      if (!job) { await heartbeatWorker(workerId, 'online'); await wait(env.TRANSCODE_POLL_INTERVAL_MS); continue; }
      await heartbeatWorker(workerId, 'busy', String(job._id), Number(job.progressPercent || 0));
      await processJob(job.toObject() as Record<string, unknown>);
    } catch (error) {
      safeLog('worker_error', { code: error instanceof Error ? error.name : 'UNKNOWN' });
      await wait(env.TRANSCODE_POLL_INTERVAL_MS);
    }
  }
}

async function main() {
  if (env.TRANSCODE_WORKER_ENABLED !== 'true') throw new Error('Set TRANSCODE_WORKER_ENABLED=true only on the dedicated transcoder service.');
  await runCapture('ffmpeg', ['-version']); await runCapture('ffprobe', ['-version']);
  await mkdir(env.TRANSCODE_TEMP_DIR, { recursive: true });
  safeLog('worker_online', { concurrency: env.TRANSCODE_CONCURRENCY, profileVersion: env.TRANSCODE_PROFILE_VERSION });
  await heartbeatWorker(workerId, 'online');
  await Promise.all(Array.from({ length: env.TRANSCODE_CONCURRENCY }, (_, index) => workerLoop(index + 1)));
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  stopping = true; activeChild?.kill('SIGTERM'); void heartbeatWorker(workerId, 'stopping').catch(() => undefined);
});

void main().catch((error) => { safeLog('worker_fatal', { code: error instanceof Error ? error.message : 'UNKNOWN' }); process.exitCode = 1; });

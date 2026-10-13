import { requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { listObjectKeys } from '@/lib/r2';
import { MediaAsset, MediaStream } from '@/models';

export async function GET() {
  try {
    await requirePermission('media.read');
    await connectDb();
    const [assetBucket, mediaBucket, assets, streams] = await Promise.all([listObjectKeys('assets'), listObjectKeys('media'), MediaAsset.find().select('objectKey bucket status').lean(), MediaStream.find({ status: { $ne: 'deleted' } }).select('prefix manifestKey active status').lean()]);
    const remoteKeys = [...assetBucket.keys.map((key) => `${assetBucket.bucket}:${key}`), ...mediaBucket.keys.map((key) => `${mediaBucket.bucket}:${key}`)];
    const remoteSet = new Set(remoteKeys);
    const databaseSet = new Set(assets.map((asset) => `${String(asset.bucket)}:${String(asset.objectKey)}`));
    const streamPrefixes = streams.map((stream) => `${mediaBucket.bucket}:${String(stream.prefix).replace(/\/$/, '')}/`);
    const missing = assets.filter((asset) => asset.status === 'active' && !remoteSet.has(`${String(asset.bucket)}:${String(asset.objectKey)}`)).map((asset) => `${String(asset.bucket)}:${String(asset.objectKey)}`);
    for (const stream of streams) if (stream.active && stream.status === 'ready' && stream.manifestKey && !remoteSet.has(`${mediaBucket.bucket}:${String(stream.manifestKey)}`)) missing.push(`${mediaBucket.bucket}:${String(stream.manifestKey)}`);
    const orphaned = remoteKeys.filter((key) => !databaseSet.has(key) && !streamPrefixes.some((prefix) => key.startsWith(prefix)));
    return Response.json({ scanned: remoteKeys.length, buckets: [assetBucket.bucket, mediaBucket.bucket], capped: assetBucket.capped || mediaBucket.capped, missing: { count: missing.length, sample: missing.slice(0, 100) }, orphaned: { count: orphaned.length, sample: orphaned.slice(0, 100) } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

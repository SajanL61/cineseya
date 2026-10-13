import { MediaVersionManager as BaseMediaVersionManager, type VersionRow } from '@/components/admin/media-version-manager';
import { DownloadServerManager } from '@/components/admin/download-server-manager';

export type { VersionRow } from '@/components/admin/media-version-manager';
export function MediaVersionManager({ contentId, initialVersions }: { contentId: string; initialVersions: VersionRow[] }) {
  return <><BaseMediaVersionManager contentId={contentId} initialVersions={initialVersions}/><DownloadServerManager versions={initialVersions}/></>;
}

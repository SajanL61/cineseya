'use client';

import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { SubtitleEditPanel } from '@/components/admin/subtitle-edit-panel';
import { SubtitlePublishAction } from '@/components/admin/subtitle-publish-action';

type Props = {
  subtitleId: string;
  fileName: string;
  language: string;
  contentTitle: string;
  contentType: 'movie' | 'episode';
  status: string;
  canEdit: boolean;
  canPublish: boolean;
};

export function SubtitleRecordActions(props: Props) {
  const [editing, setEditing] = useState(false);
  return <div className="subtitle-record-actions">
    {props.canEdit && <button type="button" className="subtitle-edit-button" onClick={() => setEditing(true)}><Pencil/>Edit</button>}
    <SubtitlePublishAction {...props}/>
    {editing && <SubtitleEditPanel subtitleId={props.subtitleId} onClose={() => setEditing(false)}/>} 
  </div>;
}

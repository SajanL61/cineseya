export type SubtitleDeleteDetails = {
  fileName: string;
  language: string;
  contentTitle: string;
  contentType: 'movie' | 'episode';
};

export function subtitleDeleteConfirmation({ fileName, language, contentTitle, contentType }: SubtitleDeleteDetails) {
  const label = contentType === 'episode' ? 'Episode' : 'Movie';
  return [
    'Delete this subtitle?',
    '',
    `File: ${fileName}`,
    `Language: ${language}`,
    `${label}: ${contentTitle}`,
    '',
    'The subtitle will be removed from CineSeya. Its database record and uploaded file will be kept for audit and recovery.',
  ].join('\n');
}

export function subtitleDeleteRequest(subtitleId: string, csrfToken: string) {
  return {
    url: `/api/admin/subtitles/${encodeURIComponent(subtitleId)}`,
    init: {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
    },
  } as const;
}

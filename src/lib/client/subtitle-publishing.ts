export type SubtitlePublishDetails = {
  fileName: string;
  language: string;
  contentTitle: string;
  contentType: 'movie' | 'episode';
};

export function subtitlePublishConfirmation({ fileName, language, contentTitle, contentType }: SubtitlePublishDetails) {
  return [
    'Publish this subtitle?',
    '',
    `File: ${fileName}`,
    `Language: ${language}`,
    `${contentType === 'movie' ? 'Movie' : 'Episode'}: ${contentTitle}`,
    '',
    'Confirm that this subtitle belongs to the linked content.',
  ].join('\n');
}

export function subtitlePublishRequest(subtitleId: string, csrfToken: string) {
  return {
    url: `/api/admin/subtitles/${encodeURIComponent(subtitleId)}`,
    init: {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ status: 'published' }),
    } satisfies RequestInit,
  };
}

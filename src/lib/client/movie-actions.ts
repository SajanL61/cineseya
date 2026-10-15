export function moviePublishConfirmation(title: string) {
  return `Publish this movie?\n\nMovie: ${title}\n\nThe movie will become visible on the public site.`;
}

export function movieArchiveConfirmation(title: string) {
  return [
    'Delete this movie from CineSeya?',
    '',
    `Movie: ${title}`,
    '',
    'The movie will be safely archived and removed from public and active admin listings. Its record, subtitles, and linked media will be preserved.',
  ].join('\n');
}

export function moviePublishRequest(movieId: string, csrfToken: string) {
  return {
    url: `/api/admin/movies/${encodeURIComponent(movieId)}`,
    init: {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ publicationStatus: 'published' }),
    },
  } as const;
}

export function movieArchiveRequest(movieId: string, csrfToken: string) {
  return {
    url: `/api/admin/movies/${encodeURIComponent(movieId)}`,
    init: {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken },
    },
  } as const;
}

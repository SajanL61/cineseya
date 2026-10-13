export function subtitleTextToVtt(input: string, format: string) {
  const normalized = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (format.toLowerCase() === 'vtt' || normalized.trimStart().startsWith('WEBVTT')) return normalized.trimStart().startsWith('WEBVTT') ? normalized : `WEBVTT\n\n${normalized}`;
  if (format.toLowerCase() !== 'srt') throw new Error('Only SRT and WebVTT subtitles can be streamed.');
  const body = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2 --> $3.$4');
  return `WEBVTT\n\n${body.trim()}\n`;
}

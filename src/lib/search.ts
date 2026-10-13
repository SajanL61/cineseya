export type SearchCandidate<T> = { item: T; values: Array<string | number | null | undefined> };

export function normalizeSearchText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function levenshteinDistance(left: string, right: string, ceiling = Number.POSITIVE_INFINITY) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  if (Math.abs(left.length - right.length) > ceiling) return ceiling + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(current[column - 1]! + 1, previous[column]! + 1, previous[column - 1]! + cost);
      current[column] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > ceiling) return ceiling + 1;
    previous = current;
  }
  return previous[right.length]!;
}

export function searchMatchScore(query: string, rawValues: Array<string | number | null | undefined>) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  const queryTokens = normalizedQuery.split(' ');
  let best = 0;
  for (const rawValue of rawValues) {
    if (rawValue === undefined || rawValue === null) continue;
    const value = normalizeSearchText(String(rawValue));
    if (!value) continue;
    if (value === normalizedQuery) best = Math.max(best, 120);
    else if (value.startsWith(normalizedQuery)) best = Math.max(best, 105);
    else if (value.includes(normalizedQuery)) best = Math.max(best, 90);
    else if (queryTokens.every((token) => value.includes(token))) best = Math.max(best, 75);

    if (normalizedQuery.length >= 4) {
      const allowance = Math.max(1, Math.floor(normalizedQuery.length * 0.25));
      const candidates = [value, ...value.split(' ')].filter((candidate) => Math.abs(candidate.length - normalizedQuery.length) <= allowance);
      for (const candidate of candidates) {
        const distance = levenshteinDistance(normalizedQuery, candidate, allowance);
        if (distance <= allowance) best = Math.max(best, 66 - distance * 6);
      }
    }
  }
  return best;
}

export function rankSearchCandidates<T>(query: string, candidates: SearchCandidate<T>[]) {
  return candidates.map((candidate, index) => ({ ...candidate, index, score: searchMatchScore(query, candidate.values) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((candidate) => candidate.item);
}

export function splitMatchedText(value: string, query: string) {
  const normalizedValue = value.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const start = normalizedValue.indexOf(normalizedQuery);
  if (!normalizedQuery || start < 0) return { before: value, match: '', after: '' };
  return { before: value.slice(0, start), match: value.slice(start, start + normalizedQuery.length), after: value.slice(start + normalizedQuery.length) };
}

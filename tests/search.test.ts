import { describe, expect, it } from 'vitest';
import { levenshteinDistance, normalizeSearchText, rankSearchCandidates, searchMatchScore, splitMatchedText } from '@/lib/search';

describe('Sinhala-first fuzzy search', () => {
  it('normalizes Unicode and punctuation without changing the source title', () => {
    const title = 'සිංහල චිත්‍රපටය';
    expect(normalizeSearchText(`  ${title}!!! `)).toBe(title);
    expect(title).toBe('සිංහල චිත්‍රපටය');
  });

  it('accepts a small misspelling but rejects unrelated text', () => {
    expect(searchMatchScore('interstelar', ['Interstellar'])).toBeGreaterThan(0);
    expect(searchMatchScore('interstelar', ['The Godfather'])).toBe(0);
    expect(levenshteinDistance('interstelar', 'interstellar')).toBe(1);
  });

  it('ranks canonical, alternative, and curated transliteration aliases deterministically', () => {
    const candidates = [
      { item: 'unrelated', values: ['Another Movie'] },
      { item: 'alias', values: ['නිධානය', 'Nidhanaya'] },
      { item: 'exact', values: ['Nidhanaya'] },
    ];
    expect(rankSearchCandidates('Nidhanaya', candidates)).toEqual(['alias', 'exact']);
  });

  it('returns safe highlight boundaries only for an actual substring', () => {
    expect(splitMatchedText('The Dark Knight', 'dark')).toEqual({ before: 'The ', match: 'Dark', after: ' Knight' });
    expect(splitMatchedText('Interstellar', 'interstelar')).toEqual({ before: 'Interstellar', match: '', after: '' });
  });
});

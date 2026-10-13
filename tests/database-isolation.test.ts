import { describe, expect, it } from 'vitest';
import { assertCineSeyaDatabaseName, DATABASE_NAME } from '../src/lib/db';

describe('MongoDB isolation', () => {
  it('allows only the dedicated CineSeya database', () => {
    expect(DATABASE_NAME).toBe('cinerusubs');
    expect(() => assertCineSeyaDatabaseName('cinerusubs')).not.toThrow();
    expect(() => assertCineSeyaDatabaseName(undefined)).toThrow('expected database');
    expect(() => assertCineSeyaDatabaseName('test')).toThrow('expected database');
  });

  it('explicitly rejects SmartReact regardless of case', () => {
    expect(() => assertCineSeyaDatabaseName('SmartReact')).toThrow('protected SmartReact database');
    expect(() => assertCineSeyaDatabaseName('smartreact')).toThrow('protected SmartReact database');
  });
});

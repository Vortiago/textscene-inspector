import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import type { FontResource } from './types';
import { resolveProjectDefaultFont } from './projectDefaultFont';
import { NOTHING_CACHED } from '../../../r3f/cacheSources';

const FONT: FontResource = {
  kind: 'file',
  bytes: new ArrayBuffer(4),
  mimeType: 'font/otf',
  fallbacks: [],
  properties: {},
};

function settingsNaming(path: string) {
  return { 'gui/theme/custom_font': path };
}

describe('resolveProjectDefaultFont', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('is null with no project settings, and requests nothing', () => {
    const pending = new Set<string>();
    expect(resolveProjectDefaultFont(null, { getCached: () => FONT }, pending)).toBeNull();
    expect(pending.size).toBe(0);
  });

  it('is null when the project sets no custom_font, or sets it empty', () => {
    const pending = new Set<string>();
    expect(resolveProjectDefaultFont({}, { getCached: () => FONT }, pending)).toBeNull();
    expect(resolveProjectDefaultFont(settingsNaming('  '), { getCached: () => FONT }, pending)).toBeNull();
    expect(pending.size).toBe(0);
  });

  it('is the cached font the setting names', () => {
    const asked: string[] = [];
    const cache = {
      getCached: (address: string) => {
        asked.push(address);
        return FONT;
      },
    };
    const pending = new Set<string>();

    expect(resolveProjectDefaultFont(settingsNaming('res://fonts/body.otf'), cache, pending)).toBe(FONT);
    expect(asked).toEqual(['res://fonts/body.otf']);
    expect(pending.size).toBe(0);
  });

  it('trims the path the setting names', () => {
    const cache = { getCached: (address: string) => (address === 'res://fonts/body.otf' ? FONT : undefined) };
    expect(resolveProjectDefaultFont(settingsNaming(' res://fonts/body.otf '), cache, new Set())).toBe(FONT);
  });

  it('is null and requests the font while the cache has not seen it', () => {
    const pending = new Set<string>();
    const resolved = resolveProjectDefaultFont(
      settingsNaming('res://fonts/late.otf'),
      NOTHING_CACHED,
      pending
    );
    expect(resolved).toBeNull();
    expect([...pending]).toEqual(['res://fonts/late.otf']);
  });

  it('is null and warns with the path when the font failed to load', () => {
    const pending = new Set<string>();
    const resolved = resolveProjectDefaultFont(
      settingsNaming('res://fonts/missing.otf'),
      { getCached: () => null },
      pending
    );
    expect(resolved).toBeNull();
    expect(pending.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('res://fonts/missing.otf');
  });

  it('warns once for a path however many solve passes read it', () => {
    const cache = { getCached: () => null };
    resolveProjectDefaultFont(settingsNaming('res://fonts/twice.otf'), cache, new Set());
    resolveProjectDefaultFont(settingsNaming('res://fonts/twice.otf'), cache, new Set());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import { NOTHING_CACHED, type CacheSource } from '../../../r3f/cacheSources';
import type { ThemeResource } from '../../styles/theme/types';
import { NO_PROJECT_FONTS, resolveProjectFonts, type PendingProjectFonts } from './projectFonts';
import type { FontResource } from './types';

const FONT: FontResource = {
  kind: 'file',
  bytes: new ArrayBuffer(4),
  mimeType: 'font/otf',
  fallbacks: [],
  properties: {},
};

const THEME: ThemeResource = {
  defaultFont: null,
  defaultFontSize: undefined,
  fonts: {},
  fontSizes: {},
  typeVariations: {},
  properties: {},
};

function settingsNaming(path: string) {
  return { 'gui/theme/custom_font': path };
}

const noPending = (): PendingProjectFonts => ({ themes: new Set(), fonts: new Set() });
const caches = (themes: CacheSource<ThemeResource>, fonts: CacheSource<FontResource>) => ({ themes, fonts });

describe('resolveProjectFonts', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('requests the theme and the font the settings name, trimmed', () => {
    const pending = noPending();
    resolveProjectFonts(
      { 'gui/theme/custom': ' res://ui.tres ', 'gui/theme/custom_font': ' res://body.otf ' },
      caches(NOTHING_CACHED, NOTHING_CACHED),
      pending
    );
    expect([...pending.themes, ...pending.fonts]).toEqual(['res://ui.tres', 'res://body.otf']);
  });

  it('requests neither for no settings, a missing key or an empty value', () => {
    const pending = noPending();
    resolveProjectFonts(null, caches(NOTHING_CACHED, NOTHING_CACHED), pending);
    resolveProjectFonts({ 'gui/theme/custom': '  ' }, caches(NOTHING_CACHED, NOTHING_CACHED), pending);
    expect([...pending.themes, ...pending.fonts]).toEqual([]);
  });

  describe('the project default font', () => {
    const defaultFontOf = (path: string, cache: CacheSource<FontResource>, pending = noPending()) =>
      resolveProjectFonts(settingsNaming(path), caches(NOTHING_CACHED, cache), pending).projectDefaultFont;

    it('is null with no project settings, and requests nothing', () => {
      const pending = noPending();

      const fonts = resolveProjectFonts(null, caches(NOTHING_CACHED, { getCached: () => FONT }), pending);

      expect(fonts).toEqual(NO_PROJECT_FONTS);
      expect(pending.fonts.size).toBe(0);
    });

    it('is null when the project sets no custom_font, or sets it empty', () => {
      const pending = noPending();

      expect(resolveProjectFonts({}, caches(NOTHING_CACHED, { getCached: () => FONT }), pending)).toEqual(
        NO_PROJECT_FONTS
      );
      expect(defaultFontOf('  ', { getCached: () => FONT }, pending)).toBeNull();
      expect(pending.fonts.size).toBe(0);
    });

    it('is the cached font the setting names', () => {
      const asked: string[] = [];
      const cache = {
        getCached: (address: string) => {
          asked.push(address);
          return FONT;
        },
      };
      const pending = noPending();

      expect(defaultFontOf('res://fonts/body.otf', cache, pending)).toBe(FONT);
      expect(asked).toEqual(['res://fonts/body.otf']);
      expect(pending.fonts.size).toBe(0);
    });

    it('trims the path the setting names', () => {
      const cache = {
        getCached: (address: string) => (address === 'res://fonts/body.otf' ? FONT : undefined),
      };

      expect(defaultFontOf(' res://fonts/body.otf ', cache)).toBe(FONT);
    });

    it('is null and requests the font while the cache has not seen it', () => {
      const pending = noPending();

      expect(defaultFontOf('res://fonts/late.otf', NOTHING_CACHED, pending)).toBeNull();
      expect([...pending.fonts]).toEqual(['res://fonts/late.otf']);
    });

    it('is null and warns with the path when the font failed to load', () => {
      const pending = noPending();

      expect(defaultFontOf('res://fonts/missing.otf', { getCached: () => null }, pending)).toBeNull();
      expect(pending.fonts.size).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]![0]).toContain('res://fonts/missing.otf');
    });

    it('warns once for a path however many solve passes read it', () => {
      const cache = { getCached: () => null };

      defaultFontOf('res://fonts/twice.otf', cache);
      defaultFontOf('res://fonts/twice.otf', cache);

      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('the project theme', () => {
    const themeOf = (cache: CacheSource<ThemeResource>, pending = noPending()) =>
      resolveProjectFonts({ 'gui/theme/custom': 'res://ui.tres' }, caches(cache, NOTHING_CACHED), pending)
        .projectTheme;

    /** `ThemeDB::initialize_theme` loads it outside every scene (`theme_db.cpp:53-80`). */
    it('is a copy of the cached theme the setting names, marked as outside every scene', () => {
      const cache = { getCached: (path: string) => (path === 'res://ui.tres' ? THEME : undefined) };
      expect(themeOf(cache)).toEqual({ ...THEME, isOutsideScenes: true });
    });

    it('is one copy however many solves ask for it', () => {
      const cache = { getCached: (path: string) => (path === 'res://ui.tres' ? THEME : undefined) };
      expect(themeOf(cache)).toBe(themeOf(cache));
    });

    it('is null and requests the theme while the cache has not seen it', () => {
      const pending = noPending();

      expect(themeOf(NOTHING_CACHED, pending)).toBeNull();
      expect([...pending.themes]).toEqual(['res://ui.tres']);
    });

    it('is null, and requests nothing, for a theme that failed to load', () => {
      const pending = noPending();

      expect(themeOf({ getCached: () => null }, pending)).toBeNull();
      expect(pending.themes.size).toBe(0);
    });

    it('is null with no theme setting, and requests nothing', () => {
      const pending = noPending();

      resolveProjectFonts({}, caches({ getCached: () => THEME }, NOTHING_CACHED), pending);

      expect(pending.themes.size).toBe(0);
    });
  });
});

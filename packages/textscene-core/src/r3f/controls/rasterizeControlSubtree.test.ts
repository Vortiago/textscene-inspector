/**
 * Unit coverage for the parts of the DOM→texture rasteriser that are pure or
 * guard-only. The rasterisation ITSELF is deliberately absent: happy-dom has no
 * layout and no rasteriser, so it can neither lay a subtree out nor draw an SVG
 * image. Those assertions live in the browser harness
 * `scripts/showcase/verify-raster.mjs` (ADR-0024's second-harness rule).
 *
 * The guard tests below matter for more than tidiness: happy-dom's `Image`
 * never settles for an SVG data URL, so a subtree that slips past the
 * measurement guard would hang the suite rather than fail it. Measuring first
 * is what keeps that unreachable.
 */

import { describe, expect, it } from 'vitest';
import {
  buildSvgDataUrl,
  extractCssUrls,
  isDataUrl,
  rasterizeControlSubtree,
  replaceCssUrls,
} from './rasterizeControlSubtree';

describe('rasterizeControlSubtree guards', () => {
  it('returns null for a missing element', async () => {
    await expect(rasterizeControlSubtree(null)).resolves.toBeNull();
    await expect(rasterizeControlSubtree(undefined)).resolves.toBeNull();
  });

  it('returns null for an element with no layout', async () => {
    // happy-dom reports a zero border box for everything — the same shape as a
    // real browser reports for a `display: none` or not-yet-laid-out subtree.
    const element = document.createElement('div');
    document.body.appendChild(element);
    await expect(rasterizeControlSubtree(element)).resolves.toBeNull();
  });

  it('returns null for a detached element', async () => {
    const element = document.createElement('div');
    await expect(rasterizeControlSubtree(element)).resolves.toBeNull();
  });

  it('returns null for a zero-size element even when a size is requested', async () => {
    // An explicit output size scales the raster; it never substitutes for a
    // source subtree that has nothing to rasterise.
    const element = document.createElement('div');
    document.body.appendChild(element);
    await expect(
      rasterizeControlSubtree(element, { width: 560, height: 360 })
    ).resolves.toBeNull();
  });
});

describe('buildSvgDataUrl', () => {
  it('wraps markup in a sized foreignObject', () => {
    const url = buildSvgDataUrl('<div/>', 560, 360);
    const svg = decodeURIComponent(url.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
    expect(url.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    // Explicit width/height + viewBox: without them some hosts draw the SVG
    // image at zero size, and the viewBox is what lets an explicit output size
    // scale the source rect.
    expect(svg).toContain('width="560" height="360"');
    expect(svg).toContain('viewBox="0 0 560 360"');
    expect(svg).toContain('<foreignObject width="100%" height="100%"><div/></foreignObject>');
  });

  it('percent-encodes non-Latin-1 text rather than dropping it', () => {
    // Control text is arbitrary Unicode, so the encoding cannot be `btoa`,
    // which throws outside Latin-1.
    const url = buildSvgDataUrl('<div>Ærlig… 日本語</div>', 10, 10);
    expect(url).not.toContain('日本語');
    expect(decodeURIComponent(url)).toContain('Ærlig… 日本語');
  });

  it('escapes the SVG markup characters that would break the data URL', () => {
    const url = buildSvgDataUrl('<div style="a:1;b:2"/>', 10, 10);
    expect(url).toContain('%22'); // quotes
    expect(url).toContain('%3C'); // <
  });
});

describe('isDataUrl', () => {
  it('accepts data URLs regardless of case or leading space', () => {
    expect(isDataUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isDataUrl('DATA:image/png;base64,AAAA')).toBe(true);
    expect(isDataUrl('  data:image/svg+xml,<svg/>')).toBe(true);
  });

  it('rejects every source Chrome refuses to load inside SVG-as-image', () => {
    expect(isDataUrl('blob:http://localhost/9a7f')).toBe(false);
    expect(isDataUrl('http://example.test/a.png')).toBe(false);
    expect(isDataUrl('/fixtures/textures/checkerboard.svg')).toBe(false);
    expect(isDataUrl('')).toBe(false);
  });
});

describe('extractCssUrls', () => {
  it('reads bare, double-quoted and single-quoted urls', () => {
    expect(extractCssUrls('url(blob:http://x/1)')).toEqual(['blob:http://x/1']);
    expect(extractCssUrls('url("blob:http://x/2")')).toEqual(['blob:http://x/2']);
    expect(extractCssUrls("url('blob:http://x/3')")).toEqual(['blob:http://x/3']);
  });

  it('reads every url in a comma list, in order', () => {
    expect(extractCssUrls('url("a.png"), url("b.png")')).toEqual(['a.png', 'b.png']);
  });

  it('ignores values that carry no url', () => {
    expect(extractCssUrls('none')).toEqual([]);
    expect(extractCssUrls('linear-gradient(red, blue)')).toEqual([]);
    expect(extractCssUrls('url()')).toEqual([]);
  });
});

describe('replaceCssUrls', () => {
  it('rewrites only the urls present in the map', () => {
    const value = 'url("blob:x"), linear-gradient(red, blue), url("data:image/png;base64,AA")';
    const out = replaceCssUrls(value, new Map([['blob:x', 'data:image/png;base64,BB']]));
    expect(out).toBe(
      'url("data:image/png;base64,BB"), linear-gradient(red, blue), url("data:image/png;base64,AA")'
    );
  });

  it('leaves the value untouched when nothing matches', () => {
    const value = 'url("blob:x")';
    expect(replaceCssUrls(value, new Map())).toBe(value);
  });

  it('normalises quoting on the urls it rewrites', () => {
    expect(replaceCssUrls('url(blob:x)', new Map([['blob:x', 'data:,y']]))).toBe('url("data:,y")');
  });
});

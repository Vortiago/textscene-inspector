import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../../../nodes/2d/ui/graphelement/graphIcons';
import '../../../nodes/2d/ui/lineedit/icons';
import '../../../nodes/2d/ui/spinbox/icons';
import { THEME_ICON_RASTERS } from './themeIconRasters.generated';
import { CHECK_BOX_ICONS, vendoredIconSvgUrls } from './themeIcons';
import { scaledSvgDataUrl } from './scaledSvgIcon';
import { themeIconSource } from './themeIconSource';

const PNG_PREFIX = 'data:image/png;base64,';
const SVG_PREFIX = 'data:image/svg+xml;base64,';

/** The pixel size in a PNG's IHDR chunk. */
function pngSize(dataUrl: string): { width: number; height: number } {
  expect(dataUrl.startsWith(PNG_PREFIX)).toBe(true);
  const header = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64');
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function svgSize(dataUrl: string): { width: number; height: number } {
  const svg = atob(dataUrl.slice(SVG_PREFIX.length));
  return {
    width: Number(/<svg\b[^>]*\swidth="([\d.]+)"/.exec(svg)?.[1]),
    height: Number(/<svg\b[^>]*\sheight="([\d.]+)"/.exec(svg)?.[1]),
  };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('themeIconSource', () => {
  it('gives Godot raster of a vendored icon at theme scale 1', () => {
    expect(themeIconSource(CHECK_BOX_ICONS.checked, 1)).toBe(THEME_ICON_RASTERS.checked);
  });

  it.each([1.5, 2])('gives the scaled SVG of a vendored icon at theme scale %s', (scale) => {
    expect(themeIconSource(CHECK_BOX_ICONS.checked, scale)).toBe(
      scaledSvgDataUrl(CHECK_BOX_ICONS.checked, scale)
    );
  });

  it('passes a URL that is not a vendored icon through at theme scale 1', () => {
    const own = `${SVG_PREFIX}PHN2Zy8+`;

    expect(themeIconSource(own, 1)).toBe(own);
  });
});

describe('the vendored icons', () => {
  const icons = [...vendoredIconSvgUrls()];

  it('hold a raster for each icon and no raster for a removed icon', () => {
    expect(Object.keys(THEME_ICON_RASTERS).sort()).toEqual(icons.map(([key]) => key).sort());
  });

  it.each(icons)('%s has a raster of the pixel size of its SVG', (key, svgUrl) => {
    expect(pngSize(THEME_ICON_RASTERS[key]!)).toEqual(svgSize(svgUrl));
  });

  it('are registered by the three modules beside themeIcons.ts and by no other', () => {
    const callers = sourceFiles(join(__dirname, '../../..'))
      .filter(
        (path) => /\bvendoredIcon\(/.test(readFileSync(path, 'utf8')) && !path.endsWith('themeIcons.ts')
      )
      .map((path) => path.split('/src/')[1])
      .sort();

    expect(callers).toEqual([
      'nodes/2d/ui/graphelement/graphIcons.ts',
      'nodes/2d/ui/lineedit/icons.ts',
      'nodes/2d/ui/spinbox/icons.ts',
    ]);
  });
});

/**
 * A canvas item that draws a texture loads it through `useCanvasItemTexture` and hands the result's
 * `canvasTexture` to `CanvasItem2D`. Loading it any other way leaves its CanvasTexture maps out of
 * the lighting, which is how Line2D drew a normal-mapped texture flat (#1219).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

/** Canvas items that call `useTexture2D` for a texture they do not draw, with the reason. */
const LOADS_NO_DRAWN_TEXTURE: Record<string, string> = {
  'nodes/2d/pointlight2d/Component.tsx': 'its texture is a light cookie, which no CanvasTexture lights',
};

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

const canvasItems = sourceFiles(SRC)
  .map((path) => ({
    name: relative(SRC, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
  }))
  .filter(({ text }) => text.includes('<CanvasItem2D'));

describe('a texture-drawing canvas item', () => {
  it('finds the canvas items that draw a texture', () => {
    const loaders = canvasItems.filter(({ text }) => text.includes('useCanvasItemTexture('));
    expect(loaders.map(({ name }) => name).sort()).toEqual([
      'nodes/2d/animatedsprite2d/Component.tsx',
      'nodes/2d/cpuparticles2d/Component.tsx',
      'nodes/2d/line2d/Component.tsx',
      'nodes/2d/polygon2d/Component.tsx',
      'nodes/2d/sprite2d/Component.tsx',
      'r3f/components/CanvasMeshItem.tsx',
    ]);
  });

  it('loads its texture through useCanvasItemTexture', () => {
    const loadsDirectly = canvasItems
      .filter(({ name, text }) => text.includes('useTexture2D(') && !(name in LOADS_NO_DRAWN_TEXTURE))
      .map(({ name }) => name);
    expect(loadsDirectly).toEqual([]);
  });

  it('passes the CanvasTexture on to CanvasItem2D', () => {
    const dropsIt = canvasItems
      .filter(({ text }) => text.includes('useCanvasItemTexture(') && !text.includes('canvasTexture={'))
      .map(({ name }) => name);
    expect(dropsIt).toEqual([]);
  });
});

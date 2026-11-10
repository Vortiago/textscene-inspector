/**
 * A canvas item that draws a texture loads it through `useCanvasItemTexture` and hands the result's
 * `canvasTexture` to `CanvasItem2D`, or to `CanvasItemSurfaceSource` where it lights its own meshes.
 * Loading it any other way leaves its CanvasTexture maps out of the lighting, which is how Line2D
 * drew a normal-mapped texture flat.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

/** Canvas items that call `useTexture2D` for a texture they do not draw, with the reason. */
const LOADS_NO_DRAWN_TEXTURE: Record<string, string> = {
  'nodes/2d/pointlight2d/Component.tsx': 'its texture is a light cookie, which no CanvasTexture lights',
};

/** Canvas items that light their own meshes, so hold no `<CanvasItem2D`. */
const LIGHTS_OWN_MESHES = ['r3f/TileSourceMesh.tsx'];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

/** The code of `text`, so a comment that names a hook is not a call. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const canvasItems = sourceFiles(SRC)
  .map((path) => ({
    name: relative(SRC, path).split(sep).join('/'),
    text: withoutComments(readFileSync(path, 'utf8')),
  }))
  .filter(({ name, text }) => text.includes('<CanvasItem2D') || LIGHTS_OWN_MESHES.includes(name));

const LOADS_THROUGH_HOOK = /\buseCanvasItemTexture(?:SampledBy)?\(/;
const LOADS_DIRECTLY = /\buseTexture2D\s*\(/;
const PASSES_CANVAS_TEXTURE = /\bcanvasTexture\s*=\s*\{|\bcanvasTexture\.slot\b/;

describe('a texture-drawing canvas item', () => {
  it('finds the canvas items that draw a texture', () => {
    const loaders = canvasItems.filter(({ text }) => LOADS_THROUGH_HOOK.test(text));
    expect(loaders.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'nodes/2d/animatedsprite2d/Component.tsx',
        'nodes/2d/cpuparticles2d/Component.tsx',
        'nodes/2d/line2d/Component.tsx',
        'nodes/2d/polygon2d/Component.tsx',
        'nodes/2d/sprite2d/Component.tsx',
        'r3f/components/CanvasMeshItem.tsx',
        'r3f/TileSourceMesh.tsx',
      ])
    );
  });

  it('loads its texture through useCanvasItemTexture', () => {
    const loadsDirectly = canvasItems
      .filter(({ name, text }) => LOADS_DIRECTLY.test(text) && !(name in LOADS_NO_DRAWN_TEXTURE))
      .map(({ name }) => name);
    expect(loadsDirectly).toEqual([]);
  });

  it('passes the CanvasTexture on to the lighting', () => {
    const dropsIt = canvasItems
      .filter(({ text }) => LOADS_THROUGH_HOOK.test(text) && !PASSES_CANVAS_TEXTURE.test(text))
      .map(({ name }) => name);
    expect(dropsIt).toEqual([]);
  });
});

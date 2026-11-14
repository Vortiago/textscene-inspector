/**
 * A canvas mesh drawer loads its texture through `useCanvasMeshTexture` and draws through
 * `CanvasMeshBody`, which hands the CanvasTexture to the lighting: the body's interface holds that,
 * so these scans hold only what no type can. Two files still hand a CanvasTexture to the lighting
 * themselves (`HANDS_BACK`), and dropping it there draws a normal-mapped texture flat, as Line2D did.
 */
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isProductionSource, walkSources } from './testing/sourceScan';

const SRC = join(import.meta.dirname, '..');

/** Canvas items that call `useTexture2D` for a texture they do not draw, with the reason. */
const LOADS_NO_DRAWN_TEXTURE: Record<string, string> = {
  'nodes/2d/pointlight2d/Component.tsx': 'its texture is a light texture, which no CanvasTexture lights',
};

/** The files that hand a CanvasTexture to the lighting themselves, with the reason. */
const HANDS_BACK: Record<string, string> = {
  'r3f/canvasMesh/CanvasMeshBody.tsx': 'every canvas mesh drawer draws through it',
  'r3f/TileSourceMesh.tsx': 'a tile run lights one surface for each source, which the body does not model',
};

/** The code of `text`, so a comment that names a hook is not a call. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const sources = walkSources([SRC], isProductionSource).map(({ file, source }) => ({
  name: relative(SRC, file).split(sep).join('/'),
  text: withoutComments(source),
}));
const canvasItems = sources.filter(({ text }) =>
  /<(?:CanvasItem2D|CanvasItemSurfaceSource|CanvasMeshBody)\b/.test(text)
);

/** A load whose CanvasTexture its caller must hand on itself. */
const LOADS_CANVAS_ITEM_TEXTURE = /\buseCanvasItemTexture(?:SampledBy)?\(/;
const LOADS_DIRECTLY = /\buseTexture2D\s*\(/;
const PASSES_CANVAS_TEXTURE = /\bcanvasTexture\s*=\s*\{|\bcanvasTexture\.slot\b/;

/** The drawers whose texture, tint and material `CanvasMeshBody` holds. */
const CANVAS_MESH_DRAWERS = ['animatedsprite2d', 'cpuparticles2d', 'line2d', 'polygon2d', 'sprite2d'].map(
  (folder) => `nodes/2d/${folder}/Component.tsx`
);
/** The drawers that mount `CanvasSurfaceMaterial` with a draw of their own, as a tile run and a CanvasGroup rect. */
const CANVAS_SURFACE_ADAPTERS = ['r3f/TileSourceMesh.tsx', 'nodes/2d/canvasgroup/Component.tsx'];
const BUILDS_ITS_OWN_MATERIAL = /<meshBasicMaterial\b|\bmaterialProgramInputs\(/;
/** What only `CanvasMeshBody` hands `CanvasItem2D`, and `CanvasItem2D` hands on inside itself. */
const PASSES_BODY_PROPS = /<CanvasItem2D\b[^>]*\b(?:canvasTexture|isDrawn)=/;
const BODY_PROP_OWNERS = ['r3f/canvasMesh/CanvasMeshBody.tsx', 'r3f/components/CanvasItem2D.tsx'];
const BUILDS_ITS_OWN_DRAW = /<meshBasicMaterial\b|\bmaterialProgramInputs\(|\buseCanvasItemTexture\(/;

describe('a texture-drawing canvas item', () => {
  it('loads its texture through useCanvasItemTexture', () => {
    const loadsDirectly = canvasItems
      .filter(({ name, text }) => LOADS_DIRECTLY.test(text) && !(name in LOADS_NO_DRAWN_TEXTURE))
      .map(({ name }) => name);
    expect(loadsDirectly).toEqual([]);
  });

  it('leaves a canvas mesh drawer no material and no texture load of its own', () => {
    const buildsItsOwn = canvasItems
      .filter(({ name, text }) => CANVAS_MESH_DRAWERS.includes(name) && BUILDS_ITS_OWN_DRAW.test(text))
      .map(({ name }) => name);
    expect(canvasItems.map(({ name }) => name)).toEqual(expect.arrayContaining(CANVAS_MESH_DRAWERS));
    expect(buildsItsOwn).toEqual([]);
  });

  it('leaves a tile run and a CanvasGroup rect no material of their own', () => {
    const buildsItsOwn = sources
      .filter(
        ({ name, text }) => CANVAS_SURFACE_ADAPTERS.includes(name) && BUILDS_ITS_OWN_MATERIAL.test(text)
      )
      .map(({ name }) => name);
    expect(sources.map(({ name }) => name)).toEqual(expect.arrayContaining(CANVAS_SURFACE_ADAPTERS));
    expect(buildsItsOwn).toEqual([]);
  });

  it('lets only the canvas mesh body hand CanvasItem2D a canvasTexture or isDrawn', () => {
    const passes = sources
      .filter(({ name, text }) => !BODY_PROP_OWNERS.includes(name) && PASSES_BODY_PROPS.test(text))
      .map(({ name }) => name);
    expect(sources.some(({ name, text }) => name === BODY_PROP_OWNERS[0] && /\bisDrawn=/.test(text))).toBe(
      true
    );
    expect(passes).toEqual([]);
  });

  it('loads a CanvasTexture outside the body only where it hands it back', () => {
    const loadsElsewhere = canvasItems
      .filter(({ name, text }) => LOADS_CANVAS_ITEM_TEXTURE.test(text) && !(name in HANDS_BACK))
      .map(({ name }) => name);
    expect(loadsElsewhere).toEqual([]);
  });

  it('passes the CanvasTexture on to the lighting', () => {
    const dropsIt = Object.keys(HANDS_BACK).filter(
      (name) => !sources.some((source) => source.name === name && PASSES_CANVAS_TEXTURE.test(source.text))
    );
    expect(dropsIt).toEqual([]);
  });
});

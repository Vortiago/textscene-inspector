/** `<TextRunMesh>` on the canvas and BMFont painters: the glyphs of a run sit on its item's whole pixels. */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { CanvasItemGroup, CanvasItemProvider } from '../../../components/CanvasItemGroup';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { computeCanvasTextCanvasLayout } from './canvasTextPainter';
import { shapeText } from './textLayout';
import { TextRunMesh } from './TextRunMesh';
import type { GlyphDrawer } from './glyphDrawer';
import { testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { withVariation } from './fontMetrics';
import type { SvgGlyphs } from './svg/svgGlyphs';
import { TRIANGLE_CONTOURS } from '../testing/triangleOutlines';

const layout = shapeText('AB', {
  fontSizePx: 16,
  boxWidthPx: 0,
  autowrapMode: AutowrapMode.AUTOWRAP_OFF,
  lineSpacingPx: 0,
  fontMetrics: createRuntimeFontMetrics({
    hasGlyph: () => true,
    scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
    measureWidthUnits: (text) => text.length * 500,
    cssFontFamily: 'scene-font-test',
  }),
});

/** The top-left corner of the run's quad, in the group's coordinates with three's +Y up. */
async function quadTopLeft(glyphDrawer: GlyphDrawer): Promise<[number, number]> {
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasItemProvider value={0}>
      <CanvasItemGroup position={[2.25, -1.75, 0]}>
        <TextRunMesh
          layout={layout}
          fontSizePx={16}
          tint={{ r: 1, g: 1, b: 1, a: 1 }}
          glyphDrawer={glyphDrawer}
        />
      </CanvasItemGroup>
    </CanvasItemProvider>
  );
  const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
  const position = mesh.geometry.getAttribute('position');
  return [position.getX(0), position.getY(0)];
}

describe('<TextRunMesh> on the canvas painter', () => {
  const { offsetXPx, offsetYPx } = computeCanvasTextCanvasLayout(layout, 0);

  it('moves its quad back to the whole item pixel at or before the run origin', async () => {
    const [x, y] = await quadTopLeft('canvasItem');
    expect(x).toBeCloseTo(-offsetXPx - 0.25, 6);
    expect(y).toBeCloseTo(offsetYPx + 0.75, 6);
  });

  it('keeps its raster when the run moves by whole pixels, as the paint reads the phase alone', async () => {
    const at = (x: number) => (
      <CanvasItemProvider value={0}>
        <CanvasItemGroup position={[x, -1.75, 0]}>
          <TextRunMesh layout={layout} fontSizePx={16} tint={{ r: 1, g: 1, b: 1, a: 1 }} />
        </CanvasItemGroup>
      </CanvasItemProvider>
    );
    const renderer = await ReactThreeTestRenderer.create(at(2.25));
    const raster = () => {
      const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
      return (mesh.material as THREE.MeshBasicMaterial).map;
    };
    const before = raster();
    await renderer.update(at(5.25));
    expect(raster()).toBe(before);
  });

  it('keeps the quad of a Label3D run at its origin', async () => {
    const [x, y] = await quadTopLeft('label3D');
    expect(x).toBeCloseTo(-offsetXPx, 6);
    expect(y).toBeCloseTo(offsetYPx, 6);
  });
});

describe('<TextRunMesh> over a face of SVG glyphs', () => {
  /** SVG glyphs whose `land` tells the subscribers a bitmap landed. */
  function landingSvgGlyphs() {
    const listeners = new Set<() => void>();
    let version = 0;
    const svgGlyphs: SvgGlyphs = {
      sizeAt: (fontSizePx) => ({
        xPpem: fontSizePx,
        yPpem: fontSizePx,
        ascender: 0,
        descender: 0,
        xScale: 0,
      }),
      readerAt: () => () => null,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      get version() {
        return version;
      },
    };
    const land = () => {
      version++;
      for (const listener of listeners) listener();
    };
    return { svgGlyphs, land };
  }

  it('repaints its raster when a glyph bitmap lands', async () => {
    const { svgGlyphs, land } = landingSvgGlyphs();
    const fontMetrics = withVariation(
      createRuntimeFontMetrics({
        hasGlyph: () => true,
        scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
        measureWidthUnits: (text) => text.length * 500,
        cssFontFamily: 'svg-glyph-test',
      }),
      { outlines: { glyphIndex: () => 7, glyphContours: () => TRIANGLE_CONTOURS, svgGlyphs } }
    );
    const svgLayout = shapeText('A', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      fontMetrics,
    });
    const renderer = await ReactThreeTestRenderer.create(
      <CanvasItemProvider value={0}>
        <TextRunMesh layout={svgLayout} fontSizePx={16} tint={{ r: 1, g: 1, b: 1, a: 1 }} />
      </CanvasItemProvider>
    );
    const raster = () => {
      const mesh = renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;
      return (mesh.material as THREE.MeshBasicMaterial).map;
    };
    const before = raster();
    await ReactThreeTestRenderer.act(async () => land());
    expect(raster()).not.toBe(before);
  });
});

describe('<TextRunMesh> over a BMFont', () => {
  const bitmapLayout = shapeText('H', {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics: testBitmapMetrics(),
  });
  const at = (x: number) => (
    <CanvasItemProvider value={0}>
      <CanvasItemGroup position={[x, -1.75, 0]}>
        <TextRunMesh layout={bitmapLayout} fontSizePx={16} tint={{ r: 1, g: 1, b: 1, a: 1 }} />
      </CanvasItemGroup>
    </CanvasItemProvider>
  );
  const meshOf = (renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) =>
    renderer.scene.findAllByType('Mesh')[0]!.instance as THREE.Mesh;

  it('floors its glyph at the canvas position of its item', async () => {
    const position = meshOf(await ReactThreeTestRenderer.create(at(2.25))).geometry.getAttribute('position');
    // `H` sits 1 px right of its pen and 4 px below the line top (`bitmapTextPainter.test.ts`).
    expect([position.getX(0), position.getY(0)]).toEqual([1 - 0.25, -(4 - 0.75)]);
  });

  it('keeps its page texture when the run moves by a fraction of a pixel', async () => {
    const renderer = await ReactThreeTestRenderer.create(at(2.25));
    const page = () => (meshOf(renderer).material as THREE.MeshBasicMaterial).map;
    const before = page();
    await renderer.update(at(2.5));
    expect(page()).toBe(before);
  });
});

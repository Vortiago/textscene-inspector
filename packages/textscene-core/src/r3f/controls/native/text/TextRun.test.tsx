/**
 * `<TextRun>`: one raster quad for each face of a `shapeText` layout. The assertions read
 * scene-graph structure only, never pixels: the paint is a golden-image concern.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { godotTextureFilterState } from '../../../../resources/textures/godotTextureFilter';
import { TextureFilter } from '../../../../godot/rendering/materials/textureFilter';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { fakeCanvasRenderer } from '../../../testing/fakeCanvasRenderer';
import { TextRun, type TextRunProps } from './TextRun';
import { shapeText } from './textLayout';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { withVariation } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { SfntOutlines } from './sfntOutlines';
import { TRIANGLE_OUTLINES } from '../testing/triangleOutlines';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { canvasColorSpaceOf, CanvasColorSpaceProvider } from '../../../canvasColorSpace';
import { OwnCanvasModulateProvider } from '../../../canvasItemModulate';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const GREY = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
/** 0.5 grey in linear, the canvas modulate of the linear-canvas tests. */
const LINEAR_GREY = new THREE.Color(0.214041, 0.214041, 0.214041);

/** `children` in a linear canvas whose canvas modulate is 0.5 grey. */
function inLinearCanvas(children: ReactNode) {
  return (
    <CanvasColorSpaceProvider value={LINEAR_CANVAS}>
      <OwnCanvasModulateProvider value={LINEAR_GREY}>{children}</OwnCanvasModulateProvider>
    </CanvasColorSpaceProvider>
  );
}

/** What the outlines peek of the bundled font answers: undefined while they load, null where they cannot be read. */
const bundled = vi.hoisted(() => ({ outlines: undefined as SfntOutlines | null | undefined }));

vi.mock('./sceneFontOutlines', () => ({
  peekOutlines: () => bundled.outlines,
  drawLoad: () => ({}),
}));

beforeEach(() => {
  bundled.outlines = TRIANGLE_OUTLINES;
});

function emboldenedLayout(embolden: number) {
  return shapeText('AB', {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics: withVariation(OPEN_SANS_FONT_METRICS, { embolden }),
  });
}

function layoutFor(text: string) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
  });
}

async function renderTextRun(props: Partial<TextRunProps> = {}) {
  return ReactThreeTestRenderer.create(
    <TextRun layout={layoutFor('AB')} fontSizePx={16} tint={WHITE} {...props} />
  );
}

/** The geometry and material of the one mesh `props` mount. */
async function renderedRunMesh(props: Partial<TextRunProps> = {}) {
  const renderer = await renderTextRun(props);
  expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
}

describe('<TextRun> over the bundled face', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Godot's default font is not MSDF, so FreeType fills every glyph (`text_server_adv.cpp:1360-1373`).
  it('draws a plain run as one raster quad, as FreeType fills every glyph', async () => {
    const mesh = await renderedRunMesh();
    expect(mesh.material.map).toBeInstanceOf(THREE.DataTexture);
    expect(mesh.geometry.getAttribute('position').count).toBe(4);
  });

  // Godot builds its default font as a font file from embedded bytes (`default_theme.cpp:1378-1388`).
  it('registers no FontFace, as the outlines draw every glyph', async () => {
    const FontFaceSpy = vi.fn();
    vi.stubGlobal('FontFace', FontFaceSpy);
    await renderedRunMesh();
    expect(FontFaceSpy).not.toHaveBeenCalled();
  });

  it('draws nothing while the outlines load', async () => {
    bundled.outlines = undefined;
    const renderer = await renderTextRun();
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it("carries a linear canvas's canvas modulate on the material, with the tint", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inLinearCanvas(<TextRun layout={layoutFor('AB')} fontSizePx={16} tint={GREY} />)
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.color.r).toBeCloseTo(0.214041 * 0.214041, 6);
  });

  it('draws nothing where the outlines cannot be read (error path)', async () => {
    bundled.outlines = null;
    const renderer = await renderTextRun();
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('draws an emboldened run as one raster quad, as FreeType emboldens every value', async () => {
    const mesh = await renderedRunMesh({ layout: emboldenedLayout(1.2) });
    expect(mesh.geometry.getAttribute('position').count).toBe(4);
  });

  it('strokes an outline ring as one raster quad, as a stroked contour', async () => {
    const mesh = await renderedRunMesh({ strokeWidthPx: 2 });
    expect(mesh.geometry.getAttribute('position').count).toBe(4);
  });

  it('draws a hex-code box (draw_hex_code_box, text_server.cpp:771-812) for a preserveControl glyph, as extra solid-colour meshes beside the raster quad', async () => {
    const layout = shapeText('A\u0001', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
      preserveControl: true,
    });
    const renderer = await renderTextRun({ layout });
    // The raster quad, the 4 frame rectangles, and the segments of the digit pair "01".
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(5);
  });

  it('draws no extra meshes for a layout with no control-codepoint glyphs', async () => {
    const renderer = await renderTextRun({ layout: layoutFor('AB') });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});

describe('<TextRun> over a canvas face', () => {
  const CANVAS_METRICS = createRuntimeFontMetrics({
    hasGlyph: () => true,
    scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
    measureWidthUnits: (text) => text.length * 500,
    cssFontFamily: 'scene-font-textrun-test',
  });

  function canvasLayoutFor(text: string) {
    return shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      fontMetrics: CANVAS_METRICS,
      lineSpacingPx: 3,
    });
  }

  it('mounts a single mesh with exactly one quad (4 verts) for a run of several glyphs', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hello')} fontSizePx={16} tint={WHITE} />
    );
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(4);
    expect(geometry.getIndex()!.count).toBe(6);
  });

  it.each([
    [TextureFilter.LINEAR_WITH_MIPMAPS, THREE.LinearMipmapLinearFilter],
    [TextureFilter.NEAREST_WITH_MIPMAPS, THREE.NearestMipmapLinearFilter],
  ] as const)(
    'builds a mip chain for a mipmapped filter %i raster (text_server_adv.cpp:3121)',
    async (filter, minFilter) => {
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun
          layout={canvasLayoutFor('Hi')}
          fontSizePx={16}
          tint={WHITE}
          textureFilter={godotTextureFilterState(filter)}
          mipmapped
        />
      );
      const map = (
        (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial
      ).map!;

      expect(map.generateMipmaps).toBe(true);
      expect(map.minFilter).toBe(minFilter);
    }
  );

  it('writes the anisotropy of a Nearest with Mipmaps and Anisotropic raster after each upload', async () => {
    const canvas = fakeCanvasRenderer({ isAllocated: false });
    const renderer = await ReactThreeTestRenderer.create(
      <canvas.wrapper>
        <TextRun
          layout={canvasLayoutFor('Hi')}
          fontSizePx={16}
          tint={WHITE}
          textureFilter={godotTextureFilterState(TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC)}
          mipmapped
        />
      </canvas.wrapper>
    );
    const map = (
      (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial
    ).map!;

    map.onUpdate!(map);

    expect(canvas.gl.texParameterf).toHaveBeenCalledTimes(1);
  });

  it('builds no mip chain unless the caller asks, as a font without generate_mipmaps has none', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
    );
    const map = (
      (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial
    ).map!;

    expect(map.generateMipmaps).toBe(false);
  });

  it("uses a plain textured material, sourced from the raster's data texture", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect((mat as unknown as { isShaderMaterial?: boolean }).isShaderMaterial).toBeUndefined();
    expect(mat.map).toBeInstanceOf(THREE.DataTexture);
    expect(mat.transparent).toBe(true);
  });

  it(
    'tags the canvas raster SRGBColorSpace -- DELIBERATELY NOT the general 2D-canvas ' +
      '`NoColorSpace` rule (`canvas2DTextureDecode.ts`) every OTHER 2D-canvas-drawn texture ' +
      '(TextureRect, theme icons, sprites) gets. Measured, not inferred ' +
      "(`unit-control-scene-font-magnified.tscn`'s header has the arbitration): `NoColorSpace` " +
      "here produces a dip below the backdrop at a magnified glyph edge that Godot's own render " +
      "of the SAME scene never shows, because Godot's own glyph texture is a coverage mask with " +
      'a CONSTANT colour channel (`text_server_adv.cpp` `rasterize_bitmap`, `FT_PIXEL_MODE_GRAY`: ' +
      '`wr[ofs+0] = 255` always, only `wr[ofs+1]` -- alpha, never sRGB-encoded -- varies), so the ' +
      "byte-vs-decoded-first blend order this file's sibling fixes correct for icons/sprites is, " +
      "for Godot's OWN text rendering, never even in play. `TextRunMesh.tsx`'s own doc has the full " +
      'derivation. This pins the decision against a future change that "completes the pattern" by ' +
      'copying the icon/sprite retag here without re-measuring.',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
      );
      const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
        .material as THREE.MeshBasicMaterial;
      expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  );

  it(
    'leaves CANVAS_SRGB_MULTIPLY UNSET, matching the kept SRGBColorSpace tag -- ' +
      "`createCanvasTextMaterial`'s own auto-detection (`map.colorSpace === NoColorSpace`) means " +
      'this follows automatically from the tag above rather than needing its own separate pin, but ' +
      "asserted here anyway: a `SRGBColorSpace` texture ALREADY gets three's automatic hardware " +
      'decode, so also setting this define would decode the sample TWICE.',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
      );
      const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
        .material as THREE.MeshBasicMaterial;
      expect(mat.defines?.CANVAS_SRGB_MULTIPLY).toBeUndefined();
    }
  );

  it(
    'keeps the SRGBColorSpace tag across a re-render that reuses the same material. ' +
      '`createCanvasTextMaterial` builds the material imperatively, never through a JSX ' +
      "`<meshBasicMaterial map={...}>`, so `@react-three/fiber`'s `colorMaps` retag never runs on it. " +
      '`renderOrder` is not a `useMemo` dep, so changing only it commits the same material again.',
    async () => {
      // The same layout object across both renders: `layout` is a `useMemo` dep,
      // so a fresh `canvasLayoutFor('Hi')` would rebuild the material by identity alone.
      const layout = canvasLayoutFor('Hi');
      const renderer = await ReactThreeTestRenderer.create(
        <TextRun layout={layout} fontSizePx={16} tint={WHITE} renderOrder={0} />
      );
      const mesh1 = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const mat = mesh1.material as THREE.MeshBasicMaterial;
      expect(mat.map!.colorSpace).toBe(THREE.SRGBColorSpace);
      await renderer.update(<TextRun layout={layout} fontSizePx={16} tint={WHITE} renderOrder={5} />);
      const mesh2 = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const matAfter = mesh2.material as THREE.MeshBasicMaterial;
      expect(matAfter).toBe(mat); // same object -- proves the memo held and this is a genuine re-commit, not a rebuild
      expect(mesh2.renderOrder).toBe(5); // proves the second commit actually applied props
      expect(matAfter.map!.colorSpace).toBe(THREE.SRGBColorSpace);
    }
  );

  it("carries the tint on the material in a linear canvas, as Godot's glyph modulate does", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inLinearCanvas(<TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={GREY} />)
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.color.r).toBeCloseTo(0.214041 * 0.214041, 6);
  });

  it('keeps the material white outside a linear canvas, where the raster carries the tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={GREY} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.color.r).toBe(1);
  });

  it('applies tint.a directly as material opacity (the canvas raster is drawn opaque; alpha is not baked into it)', async () => {
    const tint = { r: 1, g: 1, b: 1, a: 0.4 };
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={tint} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBe(0.4);
  });

  it('forwards clippingPlanes/depthTest/side to the canvas material', async () => {
    const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun
        layout={canvasLayoutFor('Hi')}
        fontSizePx={16}
        tint={WHITE}
        clippingPlanes={planes}
        depthTest
        side={THREE.FrontSide}
      />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.clippingPlanes).toEqual(planes);
    expect(mat.depthTest).toBe(true);
    expect(mat.side).toBe(THREE.FrontSide);
  });
});

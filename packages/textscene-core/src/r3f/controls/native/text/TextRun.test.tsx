/**
 * `<TextRun>`: merged glyph quads at a `shapeText` layout's positions. The
 * assertions read scene-graph structure only, never pixels: the paint is a
 * golden-image concern.
 */
import { describe, expect, it } from 'vitest';
import { godotTextureFilterState } from '../../../../resources/textures/godotTextureFilter';
import { TextureFilter } from '../../../../godot/rendering/materials/textureFilter';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { fakeCanvasRenderer } from '../../../testing/fakeCanvasRenderer';
import { TextRun, type TextRunProps } from './TextRun';
import { shapeText } from './textLayout';
import { sRGBToLinearRGB } from '../../../../utils/colorSpace';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function layoutFor(text: string, uppercase = false) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    uppercase,
    lineSpacingPx: 3,
  });
}

async function renderTextRun(props: Partial<TextRunProps> = {}) {
  return ReactThreeTestRenderer.create(
    <TextRun layout={layoutFor('AB')} fontSizePx={16} tint={WHITE} {...props} />
  );
}

describe('<TextRun>', () => {
  it('mounts a single mesh carrying the merged glyph geometry', async () => {
    const renderer = await renderTextRun();
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });

  it('tints the material from the sRGB tint, converted to linear, with alpha as opacity', async () => {
    const tint = { r: 0.2, g: 0.4, b: 0.6, a: 0.75 };
    const renderer = await renderTextRun({ tint });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    const [lr, lg, lb] = sRGBToLinearRGB(tint.r, tint.g, tint.b);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(lr, 6);
    expect(uColor.y).toBeCloseTo(lg, 6);
    expect(uColor.z).toBeCloseTo(lb, 6);
    expect(mat.uniforms.uOpacity!.value).toBe(0.75);
  });

  it('forwards distanceBias to the material', async () => {
    const renderer = await renderTextRun({ distanceBias: 0.1 });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.uniforms.uDistanceBias!.value).toBe(0.1);
  });

  it('forwards outlineColor/outlineWidthPx to the material, sRGB-converted like tint', async () => {
    const outlineColor = { r: 0, g: 0, b: 0, a: 1 };
    const renderer = await renderTextRun({ outlineColor, outlineWidthPx: 2 });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.uniforms.uOutlineWidthPx!.value).toBe(2);
    expect(mat.uniforms.uOutlineOpacity!.value).toBe(1);
    expect((mat.uniforms.uOutlineColor!.value as THREE.Vector3).toArray()).toEqual([0, 0, 0]);
  });

  it('leaves the outline width at zero when no outlineColor is given, even with a nonzero outlineWidthPx', async () => {
    const renderer = await renderTextRun({ outlineWidthPx: 2 });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.uniforms.uOutlineWidthPx!.value).toBe(0);
  });

  it('forwards clipping planes to the material (per-material state)', async () => {
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const renderer = await renderTextRun({ clippingPlanes: planes });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.clippingPlanes).toEqual(planes);
  });

  it('renders one fewer quad when the layout has an extra whitespace-only glyph', async () => {
    const renderer = await renderTextRun({ layout: layoutFor('A B') });
    const geometry = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .geometry as THREE.BufferGeometry;
    expect(geometry.getAttribute('position').count).toBe(2 * 4);
  });

  it('draws a hex-code box (draw_hex_code_box, text_server.cpp:771-812) for a preserveControl glyph, as EXTRA solid-colour meshes beside the atlas geometry', async () => {
    const layout = shapeText('A', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
      preserveControl: true,
    });
    const renderer = await renderTextRun({ layout });
    // One merged atlas-glyph mesh ('A' only -- the control char has no atlas
    // ink) plus 4 frame rects + the "01" digit pair's own segments.
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(1);
    const atlasGeometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(atlasGeometry.getAttribute('position').count).toBe(1 * 4); // only 'A'
  });

  it('draws no extra meshes for a layout with no control-codepoint glyphs (the common case, unaffected)', async () => {
    const renderer = await renderTextRun({ layout: layoutFor('AB') });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});

describe('<TextRun> — internal dispatch to the canvas painter for a "canvas"-kind FontMetrics', () => {
  const CANVAS_METRICS = createRuntimeFontMetrics({
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

  it('mounts a single mesh with EXACTLY ONE quad (4 verts), unlike the per-glyph atlas path', async () => {
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

  it('uses a plain textured material (no MSDF uniforms/shader), sourced from a canvas texture', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={WHITE} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect((mat as unknown as { isShaderMaterial?: boolean }).isShaderMaterial).toBeUndefined();
    expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
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
      "for Godot's OWN text rendering, never even in play. `TextRun.tsx`'s own doc has the full " +
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
    'keeps the SRGBColorSpace tag across a re-render that reuses the SAME material -- the ' +
      'material is built imperatively (`createCanvasTextMaterial`, a plain ' +
      '`new THREE.MeshBasicMaterial(...)`), never through a JSX `<meshBasicMaterial map={...}>` ' +
      "element, so `@react-three/fiber`'s `applyProps` `colorMaps` re-tagging never gets a chance " +
      'to run on it either way -- proving the KEPT tag survives a second commit the same way a ' +
      "retag would have (`undecodedTexture.ts`'s own doc: that re-tagging is what forces " +
      '`useIconTexture` to use `pinNoColorSpace` instead of a plain assignment there). ' +
      "`renderOrder` is deliberately NOT a `useMemo` dep (`TextRun.tsx`'s own deps list), so " +
      'changing only it forces a second commit of the SAME material/texture object.',
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

  it('applies tint.a directly as material opacity (the canvas raster is drawn opaque; alpha is not baked into it)', async () => {
    const tint = { r: 1, g: 1, b: 1, a: 0.4 };
    const renderer = await ReactThreeTestRenderer.create(
      <TextRun layout={canvasLayoutFor('Hi')} fontSizePx={16} tint={tint} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(mat.opacity).toBe(0.4);
  });

  it('forwards clippingPlanes/depthTest/side to the canvas material, same contract as the MSDF path', async () => {
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

  it('a layout shaped against the DEFAULT (atlas) metrics still takes the MSDF path — dispatch is per-layout, not global', async () => {
    const renderer = await renderTextRun(); // uses layoutFor('AB'), the default OPEN_SANS_FONT_METRICS
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.isShaderMaterial).toBe(true);
    expect(mat.uniforms.uMap).toBeDefined();
  });
});

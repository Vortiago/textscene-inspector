/**
 * `<LabelGlyphs>` — Label3D's glyph-drawing pass, tested directly rather
 * than through `Component.tsx`'s `React.lazy` boundary (see that file's own
 * doc: the lazy content never resolves synchronously under
 * `@react-three/test-renderer`, the same reason
 * `ControlRasterPass.test.tsx` renders `ControlRasterPasses` directly
 * instead of through `ControlRasterLayer`'s lazy wrapper).
 *
 * Covers what the pre-MSDF canvas-rasteriser tests pinned (text presence,
 * font_size sizing, modulate tint, outline presence/absence, no_depth_test,
 * double_sided, multi-line layout) against the new BufferGeometry +
 * ShaderMaterial shape, plus the outline pass this rewrite adds.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { createOpenSansCanvasFontMetrics } from '../../../r3f/controls/native/text/openSansCanvasFontMetrics';
import {
  CANVAS_TEXT_SUPERSAMPLE,
  CANVAS_TEXT_VERTICAL_PAD_PX,
} from '../../../r3f/controls/native/text/canvasTextPainter';
import LabelGlyphs from './LabelGlyphs';
import type { Label3DProperties } from './types';
import { AlphaCutMode, BillboardMode, HorizontalAlignment, TextureFilter } from './types';

// happy-dom has neither `FontFace` nor `document.fonts`, so the real bundled
// registration can only ever answer `undefined` here (`sceneFontLoader.ts`'s
// own doc). Mocking the two functions `LabelGlyphs` actually calls is what
// lets both sides of the gate be exercised.
const loader = vi.hoisted(() => ({ metrics: undefined as CanvasFontMetrics | undefined }));
vi.mock('../../../r3f/controls/native/text/sceneFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => loader.metrics,
  onSceneFontMetricsSettled: () => () => {},
}));

beforeEach(() => {
  loader.metrics = createOpenSansCanvasFontMetrics('label3d-test-family');
});

function props(overrides: Partial<Label3DProperties> = {}): Label3DProperties {
  return {
    name: 'L',
    text: 'Hi',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_DISABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    render_priority: 0,
    outline_render_priority: -1,
    alpha_cut: AlphaCutMode.DISABLED,
    texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
    ...overrides,
  };
}

function boundingSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  return box.getSize(new THREE.Vector3());
}

async function render(p: Label3DProperties) {
  return ReactThreeTestRenderer.create(<LabelGlyphs properties={p} />);
}

describe('<LabelGlyphs> — the canvas rasteriser gate', () => {
  it('paints through the canvas rasteriser, not the MSDF atlas (Godot default project font is not MSDF: text_server.cpp:2386)', async () => {
    const renderer = await render(props({ text: 'Hi' }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.type).toBe('MeshBasicMaterial');
    expect(material.map).toBeTruthy();
  });

  it('paints nothing at all until the bundled font registration resolves (an unregistered family rasterises a SYSTEM font silently)', async () => {
    loader.metrics = undefined;
    const renderer = await render(props({ text: 'Hi' }));
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });
});

describe('<LabelGlyphs>', () => {
  it('renders a Mesh with a non-empty BufferGeometry for non-empty text', async () => {
    const renderer = await render(props({ text: 'Hi' }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect(mesh.geometry.type).toBe('BufferGeometry');
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('renders no glyph ink for empty text — a zero-width content box, no throw', async () => {
    const renderer = await render(props({ text: '' }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    // The raster painter always emits its one quad; "no ink" is the quad
    // spanning no content at all (with no outline stroke and no skew there
    // is no horizontal pad to widen it) — down to the single device pixel a
    // canvas must be at minimum.
    expect(boundingSize(mesh).x).toBeCloseTo(1 / CANVAS_TEXT_SUPERSAMPLE, 6);
  });

  it('scales glyph geometry with font_size — to within the whole-pixel advance round, which is not proportional', async () => {
    const small = await render(props({ text: 'Hello', font_size: 32 }));
    const large = await render(props({ text: 'Hello', font_size: 64 }));
    const smallMesh = small.scene.findByType('Mesh').instance as THREE.Mesh;
    const largeMesh = large.scene.findByType('Mesh').instance as THREE.Mesh;
    const smallSize = boundingSize(smallMesh);
    const largeSize = boundingSize(largeMesh);
    // Both sizes are above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so each
    // glyph advance is rounded to a WHOLE pixel with the rounding remainder
    // carried (`text_server_adv.cpp:7079-7084`) — independently at each size,
    // and the two need not land on the same fractions. Doubling the size
    // therefore does not exactly double the pen extent; the residual is
    // bounded by the rounding, not by the scale.
    expect(Math.abs(largeSize.x - smallSize.x * 2)).toBeLessThan(2);
    // Vertically the quad carries a FIXED anti-aliasing pad on each edge
    // that does not scale with the glyphs, so the CONTENT box is what grows
    // — and it too is only near-proportional: ascent and descent each ceil
    // to a whole pixel INDEPENDENTLY at each size
    // (`text_server_adv.cpp:1515-1516`).
    const contentHeight = (size: THREE.Vector3) => size.y - 2 * CANVAS_TEXT_VERTICAL_PAD_PX;
    expect(Math.abs(contentHeight(largeSize) - contentHeight(smallSize) * 2)).toBeLessThan(3);
  });

  it("applies modulate's alpha as the material opacity (its rgb is baked into the raster, sRGB, and decoded by the texture's own tag)", async () => {
    const renderer = await render(props({ modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } }));
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.5, 6);
    expect(material.map!.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('uses a transparent material, so a translucent modulate blends over what is behind it', async () => {
    const renderer = await render(props());
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((mesh.material as THREE.Material).transparent).toBe(true);
  });

  it('no_depth_test=true → material.depthTest === false; default false → true', async () => {
    const on = await render(props({ no_depth_test: true }));
    const off = await render(props({ no_depth_test: false }));
    expect(((on.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthTest).toBe(
      false
    );
    expect(((off.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).depthTest).toBe(
      true
    );
  });

  it('double_sided=false → FrontSide material; default true → DoubleSide', async () => {
    const front = await render(props({ double_sided: false }));
    const double = await render(props({ double_sided: true }));
    expect(
      ((front.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).side
    ).toBe(THREE.FrontSide);
    expect(
      ((double.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.Material).side
    ).toBe(THREE.DoubleSide);
  });

  describe('outline pass', () => {
    // Godot emits the outline glyphs as their OWN surfaces before the fill
    // (`label_3d.cpp:610-621`), both `TRANSPARENCY_ALPHA` (`:386`) on the
    // same cached shader (`:396`) — `blend_mix, depth_draw_opaque`
    // (`material.cpp:775-812`), ordered by `material_set_render_priority`
    // (`:402`). Two overlapping alpha-blended surfaces is the engine's own
    // design, not something to collapse into one draw call.

    it('draws the outline as its own surface BEFORE the fill, at outline_render_priority then render_priority', async () => {
      const renderer = await render(props({ outline_size: 12, outline_modulate: { r: 0, g: 0, b: 0, a: 1 } }));
      const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      expect(meshes.length).toBe(2);
      expect(meshes.map((m) => m.renderOrder)).toEqual([-1, 0]);
    });

    it('carries outline_modulate alpha on the outline surface and modulate alpha on the fill', async () => {
      const renderer = await render(
        props({
          outline_size: 12,
          outline_modulate: { r: 1, g: 0, b: 0, a: 0.25 },
          modulate: { r: 1, g: 1, b: 1, a: 0.75 },
        })
      );
      const [outline, fill] = renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial);
      expect(outline!.opacity).toBeCloseTo(0.25, 6);
      expect(fill!.opacity).toBeCloseTo(0.75, 6);
    });

    it('draws the fill alone when outline_size is 0', async () => {
      const renderer = await render(props({ outline_size: 0 }));
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.length).toBe(1);
      expect((meshes[0]!.instance as THREE.Mesh).renderOrder).toBe(0);
    });

    it('draws the fill alone when outline_modulate.a is 0, even with outline_size > 0', async () => {
      const renderer = await render(
        props({ outline_size: 12, outline_modulate: { r: 0, g: 0, b: 0, a: 0 } })
      );
      expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
    });

    it('takes both surfaces\' paint order from the authored priorities, not a hardcoded pair', async () => {
      const renderer = await render(props({ outline_size: 12, render_priority: 5, outline_render_priority: 3 }));
      const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      expect(meshes.map((m) => m.renderOrder)).toEqual([3, 5]);
    });
  });

  describe('texture_filter', () => {
    // Expressible at last: a rasterised glyph texture HAS a magnification
    // filter, where a distance field never did. `label_3d.h:140` defaults to
    // LINEAR_WITH_MIPMAPS; the enum's even members are the NEAREST ones
    // (`material.h:172-177`).
    const mapFilters = (renderer: Awaited<ReturnType<typeof render>>) => {
      const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
        .material as THREE.MeshBasicMaterial;
      return { mag: material.map!.magFilter, min: material.map!.minFilter };
    };

    it('defaults to linear filtering', async () => {
      expect(mapFilters(await render(props()))).toEqual({
        mag: THREE.LinearFilter,
        min: THREE.LinearFilter,
      });
    });

    it('NEAREST magnifies the raster without smoothing', async () => {
      expect(mapFilters(await render(props({ texture_filter: TextureFilter.NEAREST })))).toEqual({
        mag: THREE.NearestFilter,
        min: THREE.NearestFilter,
      });
    });

    it('reads the nearest/linear bit of every mipmap variant, not just the two plain ones', async () => {
      const nearestMip = await render(props({ texture_filter: TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC }));
      const linearMip = await render(props({ texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC }));
      expect(mapFilters(nearestMip).mag).toBe(THREE.NearestFilter);
      expect(mapFilters(linearMip).mag).toBe(THREE.LinearFilter);
    });
  });

  describe('alpha_cut', () => {
    // `label_3d.cpp:401-405`: the priority reaches the renderer as a MATERIAL
    // render priority only while `alpha_cut == ALPHA_CUT_DISABLED`. Otherwise
    // the material leaves `TRANSPARENCY_ALPHA`, the priority comparator no
    // longer applies to it, and Godot bakes `z_shift = priority * pixel_size`
    // into the vertex Z instead (`:417-420`). Geometry here is Godot px inside
    // `Component.tsx`'s own `pixel_size` group, so the shift is the bare
    // priority.
    const surfaceZ = (renderer: Awaited<ReturnType<typeof render>>) =>
      renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as THREE.Mesh).getWorldPosition(new THREE.Vector3()).z);

    it('DISABLED (default) orders by priority and leaves every surface at z=0', async () => {
      const renderer = await render(props({ outline_size: 12 }));
      expect(surfaceZ(renderer)).toEqual([0, 0]);
      expect(renderer.scene.findAllByType('Mesh').map((m) => (m.instance as THREE.Mesh).renderOrder)).toEqual([
        -1, 0,
      ]);
    });

    it('DISCARD shifts each surface in Z by its own priority and stops ordering by it', async () => {
      const renderer = await render(props({ outline_size: 12, alpha_cut: AlphaCutMode.DISCARD }));
      expect(surfaceZ(renderer)).toEqual([-1, 0]);
      expect(renderer.scene.findAllByType('Mesh').map((m) => (m.instance as THREE.Mesh).renderOrder)).toEqual([
        0, 0,
      ]);
    });

    it('shifts by the AUTHORED priorities, not the defaults', async () => {
      const renderer = await render(
        props({ outline_size: 12, alpha_cut: AlphaCutMode.HASH, render_priority: 4, outline_render_priority: -3 })
      );
      expect(surfaceZ(renderer)).toEqual([-3, 4]);
    });
  });

  describe('multi-line text', () => {
    it('renders one line-group per newline-separated line, each exactly one linePitchPx apart', async () => {
      const renderer = await render(props({ text: 'A\nB\nC', font_size: 32 }));
      const groups = renderer.scene.children.map((c) => c.instance as THREE.Group);
      expect(groups.length).toBe(3);
      // Every line-group's own Y matches the previous one exactly one line
      // pitch further down — the render-level equivalent of the deleted
      // Component.multiline.test.tsx's "grows the quad by one line height
      // per newline" (there measured as PlaneGeometry.height deltas; here as
      // each line's own group position, since a line is now its own mesh
      // rather than one merged canvas).
      const step0 = groups[0]!.position.y - groups[1]!.position.y;
      const step1 = groups[1]!.position.y - groups[2]!.position.y;
      expect(step0).toBeGreaterThan(0);
      expect(step0).toBeCloseTo(step1, 6);
    });

    it('sizes each line-group from ITS OWN width, not the concatenated string — the widest line bounds the whole label', async () => {
      const oneLine = await render(props({ text: 'ABCDEFG' }));
      const twoLines = await render(props({ text: 'AB\nCDEFG' }));
      const oneMesh = oneLine.scene.findByType('Mesh').instance as THREE.Mesh;
      const twoMeshes = twoLines.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      // "AB\nCDEFG" concatenates to the SAME 7 glyphs as "ABCDEFG" — a
      // single-fillText/single-merged-geometry implementation would report
      // the same overall width for both. Neither of the two-line render's
      // OWN lines ("AB", "CDEFG") is as wide as the one-line render's single
      // "ABCDEFG" line, which is the render-level equivalent of the deleted
      // Component.multiline.test.tsx's "sizes the quad from the widest
      // line, not the concatenated string" (there one PlaneGeometry; here
      // one mesh per line, so the check is over ALL of them, not just one).
      const oneWidth = boundingSize(oneMesh).x;
      for (const mesh of twoMeshes) {
        expect(boundingSize(mesh).x).toBeLessThan(oneWidth);
      }
    });

    it('counts a trailing newline as an empty final line, like Godot', async () => {
      const plain = await render(props({ text: 'A' }));
      const trailing = await render(props({ text: 'A\n' }));
      expect(plain.scene.children.length).toBe(1);
      expect(trailing.scene.children.length).toBe(2);
    });
  });

  describe('horizontal_alignment', () => {
    it('FILL positions a line the same as CENTER (no per-line justification, width is unparsed)', async () => {
      const center = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.CENTER }));
      const fill = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.FILL }));
      const centerGroup = center.scene.children[0]!.instance as THREE.Group;
      const fillGroup = fill.scene.children[0]!.instance as THREE.Group;
      expect(fillGroup.position.x).toBeCloseTo(centerGroup.position.x, 6);
    });

    it('LEFT starts a line at x=0; RIGHT ends a line at x=0', async () => {
      const left = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.LEFT }));
      const right = await render(props({ text: 'Hi', horizontal_alignment: HorizontalAlignment.RIGHT }));
      const leftGroup = left.scene.children[0]!.instance as THREE.Group;
      const rightGroup = right.scene.children[0]!.instance as THREE.Group;
      expect(leftGroup.position.x).toBeCloseTo(0, 6);
      expect(rightGroup.position.x).toBeLessThan(0);
    });
  });
});

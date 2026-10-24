/**
 * `<LabelGlyphs>`, tested directly: `Component.tsx`'s `React.lazy` content never
 * resolves under `@react-three/test-renderer`. Covers text presence, font_size,
 * tint, the outline pass, no_depth_test, double_sided and multi-line layout.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DRAWN_OPAQUE_PREPASS, opaquePrepassOf } from '../../../r3f/materials/opaquePrepass';
import { alphaHashScaleUserData } from '../../../r3f/materials/godotAlphaHash';
import {
  alphaAntialiasingOf,
  alphaAntialiasingUserData,
} from '../../../r3f/materials/godotAlphaAntialiasing';
import { AlphaAntiAliasing, scissorAntialiasing } from '../../../godot/rendering/materials/alphaAntialiasing';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { createOpenSansCanvasFontMetrics } from '../../../r3f/controls/native/text/openSansCanvasFontMetrics';
import LabelGlyphs from './LabelGlyphs';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { withGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { Label3DProperties } from './types';
import { labelProperties } from './testing/labelProperties';
import { HALF_FADE_ALPHA } from '../../../r3f/testing/halfFadeAlpha';
import { manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_FILL,
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_RIGHT,
} from '../../../godot/math/alignment';
import { AlphaCutMode } from '../../../godot/rendering/materials/alphaCut';
import { TextureFilter } from '../../../godot/rendering/materials/textureFilter';

/** The painter's fixed anti-aliasing pad on each vertical raster edge, CSS px. */
const CANVAS_TEXT_VERTICAL_PAD_PX = 4;

// happy-dom has neither `FontFace` nor `document.fonts`, so the real bundled
// registration can only ever answer `undefined` here (`bundledFontLoader.ts`'s
// own doc). Mocking the two functions `LabelGlyphs` actually calls is what
// lets both sides of the gate be exercised.
const loader = vi.hoisted(() => ({ metrics: undefined as CanvasFontMetrics | undefined }));
vi.mock('../../../r3f/controls/native/text/bundledFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => loader.metrics,
}));
vi.mock('../../../r3f/controls/native/text/sceneFontLoader', () => ({
  onSceneFontMetricsSettled: () => () => {},
}));

beforeEach(() => {
  loader.metrics = createOpenSansCanvasFontMetrics('label3d-test-family');
});

function boundingSize(mesh: THREE.Mesh): THREE.Vector3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox!;
  return box.getSize(new THREE.Vector3());
}

/** The glyphs inside their node's GeometryInstance3D scope, as `Component.tsx` mounts them. */
const ScopedGlyphs = withGeometryInstance(({ node }: NodeComponentProps) => (
  <LabelGlyphs nodeRef={{ current: null }} properties={node.properties as Label3DProperties} />
));

async function render(p: Label3DProperties) {
  const node = { name: 'L', type: 'Label3D', rawProperties: {}, children: [], properties: p };
  return ReactThreeTestRenderer.create(<ScopedGlyphs node={node} />);
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** The one glyph mesh of a single-line label. */
function meshOf(renderer: Rendered): THREE.Mesh {
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

async function renderGlyphMesh(properties: Label3DProperties) {
  const mesh = meshOf(await render(properties));
  return { mesh, map: (mesh.material as THREE.MeshBasicMaterial).map! };
}

/** One group per line, inside the group the visibility range shows or hides. */
function lineGroups(renderer: Awaited<ReturnType<typeof render>>): THREE.Group[] {
  return renderer.scene.children[0]!.children.map((c) => c.instance as THREE.Group);
}

describe('<LabelGlyphs> — the canvas rasteriser gate', () => {
  it('paints through the canvas rasteriser, not the MSDF atlas (Godot default project font is not MSDF: text_server.cpp:2386)', async () => {
    const renderer = await render(labelProperties({ text: 'Hi' }));
    const mesh = meshOf(renderer);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.type).toBe('MeshBasicMaterial');
    expect(material.map).toBeTruthy();
  });

  it('paints nothing at all until the bundled font registration resolves (an unregistered family rasterises a SYSTEM font silently)', async () => {
    loader.metrics = undefined;
    const renderer = await render(labelProperties({ text: 'Hi' }));
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });
});

describe('<LabelGlyphs> — the glyph raster', () => {
  // The mesh is in font pixels, as `pixel_size` scales its parent group. `label_3d.cpp:345-350`
  // asks the text server for the glyph at `font_size`, which rasterises at that size and no
  // larger (`text_server_adv.h:406-413`).
  it.each([16, 32, 128])('has one texel per font pixel at font_size %i', async (fontSize) => {
    const { mesh, map } = await renderGlyphMesh(
      labelProperties({ text: 'Hello', font_size: fontSize, outline_size: 0 })
    );
    const raster = map.image as HTMLCanvasElement;
    const quad = boundingSize(mesh);
    expect([raster.width, raster.height]).toEqual([quad.x, quad.y]);
  });

  // Godot's glyph atlas has no mip chain unless the font sets `generate_mipmaps`,
  // which defaults off (`text_server_adv.h:333`, `font.cpp:1426`, `text_server_adv.cpp:3528`).
  it('builds no mip chain for the default LINEAR_WITH_MIPMAPS filter', async () => {
    const { map } = await renderGlyphMesh(labelProperties({ text: 'Hello' }));
    expect(map.generateMipmaps).toBe(false);
  });
});

describe('<LabelGlyphs>', () => {
  it('renders a Mesh with a non-empty BufferGeometry for non-empty text', async () => {
    const renderer = await render(labelProperties({ text: 'Hi' }));
    const mesh = meshOf(renderer);
    expect(mesh.geometry.type).toBe('BufferGeometry');
    expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('renders no glyph ink for empty text — a zero-width content box, no throw', async () => {
    const renderer = await render(labelProperties({ text: '' }));
    const mesh = meshOf(renderer);
    // The raster painter always emits its one quad. "No ink" is the quad at
    // the one pixel a canvas must have, since with no outline stroke
    // and no skew no horizontal pad widens it.
    expect(boundingSize(mesh).x).toBeCloseTo(1, 6);
  });

  it('scales glyph geometry with font_size — to within the whole-pixel advance round, which is not proportional', async () => {
    const small = await render(labelProperties({ text: 'Hello', font_size: 32 }));
    const large = await render(labelProperties({ text: 'Hello', font_size: 64 }));
    const smallMesh = meshOf(small);
    const largeMesh = meshOf(large);
    const smallSize = boundingSize(smallMesh);
    const largeSize = boundingSize(largeMesh);
    // Both sizes are above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so each advance
    // rounds to a whole pixel with the remainder carried (`text_server_adv.cpp:7079-7084`),
    // independently at each size. Doubling the size does not exactly double the
    // pen extent: the residual is bounded by the rounding.
    expect(Math.abs(largeSize.x - smallSize.x * 2)).toBeLessThan(2);
    // The quad's vertical anti-aliasing pad is fixed, so the content box is what
    // grows, and only near-proportionally: ascent and descent each ceil to a
    // whole pixel independently at each size (`text_server_adv.cpp:1515-1516`).
    const contentHeight = (size: THREE.Vector3) => size.y - 2 * CANVAS_TEXT_VERTICAL_PAD_PX;
    expect(Math.abs(contentHeight(largeSize) - contentHeight(smallSize) * 2)).toBeLessThan(3);
  });

  it("applies modulate's alpha as the material opacity (its rgb is baked into the raster, sRGB, and decoded by the texture's own tag)", async () => {
    const renderer = await render(labelProperties({ modulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } }));
    const mesh = meshOf(renderer);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.5, 6);
    expect(material.map!.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('uses a transparent material, so a translucent modulate blends over what is behind it', async () => {
    const renderer = await render(labelProperties());
    const mesh = meshOf(renderer);
    expect((mesh.material as THREE.Material).transparent).toBe(true);
  });

  it('no_depth_test=true → material.depthTest === false; default false → true', async () => {
    const on = await render(labelProperties({ no_depth_test: true }));
    const off = await render(labelProperties({ no_depth_test: false }));
    expect((meshOf(on).material as THREE.Material).depthTest).toBe(false);
    expect((meshOf(off).material as THREE.Material).depthTest).toBe(true);
  });

  it('double_sided=false → FrontSide material; default true → DoubleSide', async () => {
    const front = await render(labelProperties({ double_sided: false }));
    const double = await render(labelProperties({ double_sided: true }));
    expect((meshOf(front).material as THREE.Material).side).toBe(THREE.FrontSide);
    expect((meshOf(double).material as THREE.Material).side).toBe(THREE.DoubleSide);
  });

  describe('outline pass', () => {
    // Godot emits the outline glyphs as their own surfaces before the fill
    // (`label_3d.cpp:610-621`), both `TRANSPARENCY_ALPHA` (`:386`) on one cached
    // shader (`:396`), `blend_mix, depth_draw_opaque` (`material.cpp:775-812`),
    // ordered by `material_set_render_priority` (`:402`).

    it('draws the outline as its own surface BEFORE the fill, at outline_render_priority then render_priority', async () => {
      const renderer = await render(
        labelProperties({ outline_size: 12, outline_modulate: { r: 0, g: 0, b: 0, a: 1 } })
      );
      const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      expect(meshes.length).toBe(2);
      expect(meshes.map((m) => m.renderOrder)).toEqual([-1, 0]);
    });

    it('carries outline_modulate alpha on the outline surface and modulate alpha on the fill', async () => {
      const renderer = await render(
        labelProperties({
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
      const renderer = await render(labelProperties({ outline_size: 0 }));
      const meshes = renderer.scene.findAllByType('Mesh');
      expect(meshes.length).toBe(1);
      expect((meshes[0]!.instance as THREE.Mesh).renderOrder).toBe(0);
    });

    it('draws the fill alone when outline_modulate.a is 0, even with outline_size > 0', async () => {
      const renderer = await render(
        labelProperties({ outline_size: 12, outline_modulate: { r: 0, g: 0, b: 0, a: 0 } })
      );
      expect(renderer.scene.findAllByType('Mesh').length).toBe(1);
    });

    it("takes both surfaces' paint order from the authored priorities, not a hardcoded pair", async () => {
      const renderer = await render(
        labelProperties({ outline_size: 12, render_priority: 5, outline_render_priority: 3 })
      );
      const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      expect(meshes.map((m) => m.renderOrder)).toEqual([3, 5]);
    });
  });

  describe('texture_filter', () => {
    // `label_3d.h:140` defaults to LINEAR_WITH_MIPMAPS. The enum's even members
    // are the NEAREST ones (`material.h:172-177`).
    const mapFilters = (renderer: Awaited<ReturnType<typeof render>>) => {
      const material = meshOf(renderer).material as THREE.MeshBasicMaterial;
      return { mag: material.map!.magFilter, min: material.map!.minFilter };
    };

    it('defaults to linear filtering', async () => {
      expect(mapFilters(await render(labelProperties()))).toEqual({
        mag: THREE.LinearFilter,
        min: THREE.LinearFilter,
      });
    });

    it('NEAREST magnifies the raster without smoothing', async () => {
      expect(mapFilters(await render(labelProperties({ texture_filter: TextureFilter.NEAREST })))).toEqual({
        mag: THREE.NearestFilter,
        min: THREE.NearestFilter,
      });
    });

    it('reads the nearest/linear bit of every mipmap variant, not just the two plain ones', async () => {
      const nearestMip = await render(
        labelProperties({ texture_filter: TextureFilter.NEAREST_WITH_MIPMAPS_ANISOTROPIC })
      );
      const linearMip = await render(
        labelProperties({ texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC })
      );
      expect(mapFilters(nearestMip).mag).toBe(THREE.NearestFilter);
      expect(mapFilters(linearMip).mag).toBe(THREE.LinearFilter);
    });
  });

  describe('alpha_cut', () => {
    // `label_3d.cpp:401-405`: the priority is a material render priority only
    // while `alpha_cut == ALPHA_CUT_DISABLED`. Otherwise Godot bakes `z_shift =
    // priority * pixel_size` into the vertex Z (`:417-420`), and here, in Godot px
    // inside the `pixel_size` group, the shift is the bare priority.
    const surfaceZ = (renderer: Awaited<ReturnType<typeof render>>) =>
      renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as THREE.Mesh).getWorldPosition(new THREE.Vector3()).z);

    it('DISABLED (default) orders by priority and leaves every surface at z=0', async () => {
      const renderer = await render(labelProperties({ outline_size: 12 }));
      expect(surfaceZ(renderer)).toEqual([0, 0]);
      expect(renderer.scene.findAllByType('Mesh').map((m) => (m.instance as THREE.Mesh).renderOrder)).toEqual(
        [-1, 0]
      );
    });

    it('DISCARD shifts each surface in Z by its own priority and stops ordering by it', async () => {
      const renderer = await render(labelProperties({ outline_size: 12, alpha_cut: AlphaCutMode.DISCARD }));
      expect(surfaceZ(renderer)).toEqual([-1, 0]);
      expect(renderer.scene.findAllByType('Mesh').map((m) => (m.instance as THREE.Mesh).renderOrder)).toEqual(
        [0, 0]
      );
    });

    it('shifts by the AUTHORED priorities, not the defaults', async () => {
      const renderer = await render(
        labelProperties({
          outline_size: 12,
          alpha_cut: AlphaCutMode.HASH,
          render_priority: 4,
          outline_render_priority: -3,
        })
      );
      expect(surfaceZ(renderer)).toEqual([-3, 4]);
    });

    // `label_3d.cpp:386-393` picks the material's transparency from the same
    // property, which is the half the z-shift tests above do not cover.
    const materials = (renderer: Awaited<ReturnType<typeof render>>) =>
      renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial);

    it('DISCARD scissors at the authored alpha_scissor_threshold and paints opaque', async () => {
      // `label_3d.cpp:388` -> TRANSPARENCY_ALPHA_SCISSOR, whose threshold is
      // the node's own (`label_3d.h:62`, `:378`); the cut forces `alpha = 1.0`
      // (`scene_forward_clustered.glsl:1413-1415`) so the surface lands in the
      // opaque list and writes depth.
      const renderer = await render(
        labelProperties({ outline_size: 12, alpha_cut: AlphaCutMode.DISCARD, alpha_scissor_threshold: 0.25 })
      );
      for (const material of materials(renderer)) {
        expect(material.alphaTest).toBe(0.25);
        expect(material.alphaHash).toBe(false);
        expect(material.transparent).toBe(false);
        expect(material.depthWrite).toBe(true);
      }
    });

    it('HASH cuts stochastically and paints opaque', async () => {
      // `label_3d.cpp:392`.
      const hash = await render(
        labelProperties({ alpha_cut: AlphaCutMode.HASH, alpha_scissor_threshold: 0.25 })
      );
      const [hashMaterial] = materials(hash);
      expect(hashMaterial!.alphaHash).toBe(true);
      expect(hashMaterial!.alphaTest).toBe(0);
      expect(hashMaterial!.transparent).toBe(false);
      expect(hashMaterial!.depthWrite).toBe(true);
    });

    it('OPAQUE_PREPASS blends uncut and leaves its depth to the depth prepass', async () => {
      // `label_3d.cpp:390`. The prepass cut is the scene's `opaque_prepass_threshold`
      // (`render_forward_clustered.cpp:1791`), not the node's `alpha_scissor_threshold`.
      const prepass = await render(
        labelProperties({ alpha_cut: AlphaCutMode.OPAQUE_PREPASS, alpha_scissor_threshold: 0.25 })
      );
      const [prepassMaterial] = materials(prepass);
      expect(prepassMaterial!.alphaHash).toBe(false);
      expect(prepassMaterial!.alphaTest).toBe(0);
      expect(prepassMaterial!.transparent).toBe(true);
      expect(prepassMaterial!.depthWrite).toBe(false);
      expect(opaquePrepassOf(prepassMaterial!)).toBe(DRAWN_OPAQUE_PREPASS);
    });

    it('HASH hashes at the authored alpha_hash_scale', async () => {
      const renderer = await render(labelProperties({ alpha_cut: AlphaCutMode.HASH, alpha_hash_scale: 0.3 }));
      const [material] = materials(renderer);
      expect(material!.userData).toMatchObject(alphaHashScaleUserData(0.3));
    });

    it('DISCARD under alpha_antialiasing_mode turns alpha to coverage on and ramps past the threshold', async () => {
      // `label_3d.cpp:397` hands the mode and edge to `get_material_for_2d`, whose shader ramps at
      // `clamp(threshold + edge)` (`scene_forward_clustered.glsl:1408-1410`).
      const renderer = await render(
        labelProperties({
          alpha_cut: AlphaCutMode.DISCARD,
          alpha_scissor_threshold: 0.25,
          alpha_antialiasing_mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
          alpha_antialiasing_edge: 0.5,
        })
      );
      const [material] = materials(renderer);
      expect(material!.alphaToCoverage).toBe(true);
      expect(material!.alphaTest).toBe(0);
      expect(material!.transparent).toBe(true);
      expect(alphaAntialiasingOf(material!)).toEqual(
        scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.25, 0.5)
      );
    });

    it("measures the edge's mip level in Godot's glyph texels, one per font pixel", async () => {
      // `label_3d.cpp:345-350` caches the glyph at its font size, and the raster paints it at that size.
      const cut = scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.5, 0);
      const renderer = await render(
        labelProperties({
          alpha_cut: AlphaCutMode.DISCARD,
          alpha_antialiasing_mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
        })
      );
      const [material] = materials(renderer);
      expect(material!.userData).toMatchObject(alphaAntialiasingUserData(cut));
    });

    it('HASH under ALPHA_TO_COVERAGE_AND_TO_ONE overwrites the colour with the coverage blend', async () => {
      const renderer = await render(
        labelProperties({
          alpha_cut: AlphaCutMode.HASH,
          alpha_antialiasing_mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
        })
      );
      const [material] = materials(renderer);
      expect(material!.alphaToCoverage).toBe(true);
      expect(material!.alphaHash).toBe(true);
      expect(material!.blendSrc).toBe(THREE.OneFactor);
    });

    it('DISABLED ignores alpha_antialiasing_mode, as the switch never reaches a cut (edge case)', async () => {
      const renderer = await render(
        labelProperties({ alpha_antialiasing_mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE })
      );
      const [material] = materials(renderer);
      expect(material!.alphaToCoverage).toBe(false);
      expect(alphaAntialiasingOf(material!)).toBeNull();
    });

    it('DISABLED (default) paints TRANSPARENCY_ALPHA — blended, no cut, no depth write', async () => {
      const renderer = await render(labelProperties({ alpha_scissor_threshold: 0.25 }));
      const [material] = materials(renderer);
      expect(material!.transparent).toBe(true);
      expect(material!.depthWrite).toBe(false);
      expect(material!.alphaTest).toBe(0);
      expect(material!.alphaHash).toBe(false);
    });
  });

  describe('transparency', () => {
    /** A camera the cull fades the label for. */
    const VIEW = manualCameraAt({ x: 0, y: 0, z: 5 });

    // GeometryInstance3D's: one fade alpha for the fill and the outline alike.
    const materials = (renderer: Awaited<ReturnType<typeof render>>) =>
      renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as THREE.Mesh).material as THREE.MeshBasicMaterial);

    it('multiplies the fade alpha into both surfaces', async () => {
      const renderer = await render(
        labelProperties({
          outline_size: 12,
          outline_modulate: { r: 0, g: 0, b: 0, a: 0.5 },
          transparency: 0.5,
        })
      );
      await renderScene(renderer, VIEW);
      expect(materials(renderer).map((m) => m.opacity)).toEqual([0.5 * HALF_FADE_ALPHA, HALF_FADE_ALPHA]);
    });

    it('writes a discard-cut label unblended in the alpha pass', async () => {
      const renderer = await render(labelProperties({ alpha_cut: AlphaCutMode.DISCARD, transparency: 0.5 }));
      await renderScene(renderer, VIEW);
      const [material] = materials(renderer);
      expect(material).toMatchObject({ transparent: true, depthWrite: false, blending: THREE.NoBlending });
    });
  });

  describe('multi-line text', () => {
    it('renders one line-group per newline-separated line, each exactly one linePitchPx apart', async () => {
      const renderer = await render(labelProperties({ text: 'A\nB\nC', font_size: 32 }));
      const groups = lineGroups(renderer);
      expect(groups.length).toBe(3);
      // Each line is its own mesh in its own group, not one quad whose
      // PlaneGeometry.height grows, so each group's Y sits one line pitch lower.
      const step0 = groups[0]!.position.y - groups[1]!.position.y;
      const step1 = groups[1]!.position.y - groups[2]!.position.y;
      expect(step0).toBeGreaterThan(0);
      expect(step0).toBeCloseTo(step1, 6);
    });

    it('sizes each line-group from ITS OWN width, not the concatenated string — the widest line bounds the whole label', async () => {
      const oneLine = await render(labelProperties({ text: 'ABCDEFG' }));
      const twoLines = await render(labelProperties({ text: 'AB\nCDEFG' }));
      const oneMesh = meshOf(oneLine);
      const twoMeshes = twoLines.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      // "AB\nCDEFG" has the same 7 glyphs as "ABCDEFG", so one merged geometry
      // would report one width for both. Each line is its own mesh, so no line
      // of the two-line render may be as wide as the one-line render.
      const oneWidth = boundingSize(oneMesh).x;
      for (const mesh of twoMeshes) {
        expect(boundingSize(mesh).x).toBeLessThan(oneWidth);
      }
    });

    it('counts a trailing newline as an empty final line, like Godot', async () => {
      const plain = await render(labelProperties({ text: 'A' }));
      const trailing = await render(labelProperties({ text: 'A\n' }));
      expect(lineGroups(plain).length).toBe(1);
      expect(lineGroups(trailing).length).toBe(2);
    });
  });

  describe('horizontal_alignment', () => {
    it('FILL positions a line the same as CENTER (no per-line justification, width is unparsed)', async () => {
      const center = await render(
        labelProperties({ text: 'Hi', horizontal_alignment: HORIZONTAL_ALIGNMENT_CENTER })
      );
      const fill = await render(
        labelProperties({ text: 'Hi', horizontal_alignment: HORIZONTAL_ALIGNMENT_FILL })
      );
      const centerGroup = lineGroups(center)[0]!;
      const fillGroup = lineGroups(fill)[0]!;
      expect(fillGroup.position.x).toBeCloseTo(centerGroup.position.x, 6);
    });

    it('LEFT starts a line at x=0; RIGHT ends a line at x=0', async () => {
      const left = await render(
        labelProperties({ text: 'Hi', horizontal_alignment: HORIZONTAL_ALIGNMENT_LEFT })
      );
      const right = await render(
        labelProperties({ text: 'Hi', horizontal_alignment: HORIZONTAL_ALIGNMENT_RIGHT })
      );
      const leftGroup = lineGroups(left)[0]!;
      const rightGroup = lineGroups(right)[0]!;
      expect(leftGroup.position.x).toBeCloseTo(0, 6);
      expect(rightGroup.position.x).toBeLessThan(0);
    });
  });
});

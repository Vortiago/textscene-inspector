/**
 * `<StyleBoxQuad>` — renders `styleBoxFlatGeometry`'s output as a
 * `BufferGeometry` mesh, the "house recipe" 2D material every flat-shaded
 * canvas item in this codebase uses (`meshBasicMaterial`, `vertexColors`,
 * `transparent`, `depthWrite={false}`, `THREE.DoubleSide` — see
 * `nodes/2d/polygon2d/Component.tsx`'s `FilledPolygon`).
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { StyleBoxQuad } from './StyleBoxQuad';
import type { StyleBoxFlatData } from './styleBoxFlat';
import type { StyleBoxLineBox, StyleBoxTextureBox } from './parseStyleBox';
import { sRGBChannelToLinear } from '../../../utils/colorSpace';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function box(overrides: Partial<StyleBoxFlatData>): StyleBoxFlatData {
  return {
    bgColor: { r: 1, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 1, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { ...ZERO_SIDES },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('<StyleBoxQuad>', () => {
  it('builds an indexed BufferGeometry matching styleBoxFlatGeometry\'s vertex/index counts', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
    // Sharp rect, draw_center only: 8 vertices, 6 triangles (see
    // styleBoxFlatGeometry.test.ts's "a sharp rect" case for the derivation).
    expect(geom.attributes.position!.count).toBe(8);
    expect(geom.getIndex()!.count).toBe(18);
    expect(geom.attributes.color!.count).toBe(8);
    expect(geom.attributes.color!.itemSize).toBe(4);
  });

  it('applies the house material recipe: vertex colours, transparent, no depth write, double-sided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.type).toBe('MeshBasicMaterial');
    expect(mat.vertexColors).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('forces a single pass, so the rings paint in index order rather than split by facing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    // `WebGLRenderer` draws a `transparent` + `DoubleSide` material TWICE —
    // once culled to `BackSide`, then once to `FrontSide` — unless the
    // material opts out. `styleBoxFlatGeometry`'s rings alternate winding
    // (see its own "ring triangulation coverage" cases), so that split hands
    // each pass one triangle per ring quad and reorders the shadow ring's
    // half after the border ring's.
    expect(mat.forceSinglePass).toBe(true);
  });

  it('uploads vertex colours in raw sRGB, leaving the transfer function to the shader', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad
        styleBox={box({ bgColor: { r: 1, g: 0.5, b: 0, a: 1 } })}
        rect={{ x: 0, y: 0, w: 100, h: 50 }}
        renderOrder={0}
      />
    );
    const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
    const color = geom.attributes.color as THREE.BufferAttribute;
    // Godot interpolates a `border_blend` ramp between two sRGB colours and
    // the rasterizer interpolates VERTEX attributes, so the attribute has to
    // still be in sRGB at that point — linearising here (0.5 →
    // sRGBChannelToLinear(0.5) ≈ 0.2140) made the GPU interpolate the ramp in
    // the wrong space. See this component's own doc.
    expect(color.getX(0)).toBeCloseTo(1, 4);
    expect(color.getY(0)).toBeCloseTo(0.5, 4);
    expect(color.getZ(0)).toBeCloseTo(0, 4);
    expect(color.getW(0)).toBeCloseTo(1, 4);
    expect(color.getY(0)).not.toBeCloseTo(sRGBChannelToLinear(0.5), 3);
  });

  it('decodes those sRGB vertex colours in the fragment shader, before the multiply into diffuseColor', async () => {
    // The conversion has to happen PER FRAGMENT — that is the whole point of
    // moving it off the vertex attribute. Asserted on the injected source
    // rather than a rendered pixel: `@react-three/test-renderer`'s mock GL
    // never compiles a shader, so this pins the injection, and a real
    // compilation of it is covered only by the browser gates.
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(mat.customProgramCacheKey!()).toContain('stylebox');

    const shader = { fragmentShader: '#include <color_fragment>' };
    mat.onBeforeCompile!(shader as never, null as never);
    expect(shader.fragmentShader).not.toContain('#include <color_fragment>');
    // Godot's own curve, `Color::srgb_to_linear` (`utils/colorSpace.ts`) —
    // knee at 0.04045, `/ 12.92` below it and `pow((c + 0.055) / 1.055, 2.4)`
    // above.
    expect(shader.fragmentShader).toContain('0.04045');
    expect(shader.fragmentShader).toContain('12.92');
    expect(shader.fragmentShader).toContain('2.4');
    // Alpha carries no transfer function, and the AA feather rings interpolate
    // exactly that channel — converting it would feather wrong.
    expect(shader.fragmentShader).toContain('vColor.a');
  });

  it('renders nothing (no mesh) when the stylebox draws no geometry (draw_center false, no border)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({ drawCenter: false })} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    expect(() => renderer.scene.findByType('Mesh')).toThrow();
  });

  it('disposes the previous geometry when the stylebox changes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StyleBoxQuad styleBox={box({})} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
    );
    const firstGeom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
    const disposeSpy = vi.spyOn(firstGeom, 'dispose');

    await renderer.update(
      <StyleBoxQuad
        styleBox={box({ bgColor: { r: 0, g: 0, b: 1, a: 1 } })}
        rect={{ x: 0, y: 0, w: 100, h: 50 }}
        renderOrder={0}
      />
    );

    expect(disposeSpy).toHaveBeenCalled();
  });

  describe('color override', () => {
    it('composes the tint into bg_color/border_color in raw sRGB — 0.5 * 0.5 = 0.25, not 0.125', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ bgColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}
          renderOrder={0}
        />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      const color = geom.attributes.color as THREE.BufferAttribute;

      // Composed in sRGB and left there: 0.5 * 0.5 = 0.25. Composing in
      // LINEAR instead would give sRGBChannelToLinear(0.5) ** 2 ≈ 0.0334,
      // which the shader's own decode could never recover.
      const composedInLinear = sRGBChannelToLinear(0.5) * sRGBChannelToLinear(0.5);
      expect(0.25).not.toBeCloseTo(composedInLinear, 3);

      expect(color.getX(0)).toBeCloseTo(0.25, 5);
      expect(color.getY(0)).toBeCloseTo(0.25, 5);
      expect(color.getZ(0)).toBeCloseTo(0.25, 5);
    });

    it('tints borderColor the same way as bgColor', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ borderColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, borderWidth: { left: 5, top: 5, right: 5, bottom: 5 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}
          renderOrder={0}
        />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      // Vertex 1 is the border ring's first OUTER (border_color) vertex — see
      // styleBoxFlatGeometry.test.ts's border_blend fixture for the even/odd
      // inner/outer ordering this relies on.
      expect(color.getX(1)).toBeCloseTo(0.25, 5);
    });

    it('defaults to no tint (opaque white) when the prop is omitted, matching pre-existing behaviour', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad styleBox={box({ bgColor: { r: 0.8, g: 0.8, b: 0.8, a: 1 } })} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getX(0)).toBeCloseTo(0.8, 5);
    });

    it('multiplies alpha too (tint.a composes into the vertex alpha channel)', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={box({ bgColor: { r: 1, g: 1, b: 1, a: 0.8 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 1, g: 1, b: 1, a: 0.5 }}
          renderOrder={0}
        />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getW(0)).toBeCloseTo(0.4, 5);
    });
  });

  describe('line StyleBox kind', () => {
    function lineBox(overrides: Partial<StyleBoxLineBox['line']> = {}): StyleBoxLineBox {
      return {
        ...box({}),
        styleBoxKind: 'line',
        line: {
          color: { r: 0, g: 1, b: 0, a: 1 },
          thickness: 4,
          vertical: false,
          growBegin: 0,
          growEnd: 0,
          margin: { left: 0, top: 0, right: 0, bottom: 0 },
          ...overrides,
        },
      };
    }

    it("draws a solid rect at StyleBoxLine::draw's own grow/thicken rect, coloured by the line's own colour", async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad styleBox={lineBox()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      expect(bb.min.x).toBeCloseTo(0);
      expect(bb.max.x).toBeCloseTo(100);
      expect(bb.min.y).toBeCloseTo(0);
      expect(bb.max.y).toBeCloseTo(4);

      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getX(0)).toBeCloseTo(0, 5);
      expect(color.getY(0)).toBeCloseTo(1, 5);
      expect(color.getZ(0)).toBeCloseTo(0, 5);
    });

    it('grows the rect by grow_begin/grow_end, independent of the rect it is handed', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={lineBox({ growBegin: 2, growEnd: 3 })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          renderOrder={0}
        />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      // x -= growBegin (2); w += growBegin + growEnd (2 + 3 = 5) → 100 - 2 + 5 = 103.
      expect(bb.min.x).toBeCloseTo(-2);
      expect(bb.max.x).toBeCloseTo(103);
    });

    it('composes the CanvasItem tint into the line colour, in raw sRGB', async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <StyleBoxQuad
          styleBox={lineBox({ color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
          rect={{ x: 0, y: 0, w: 100, h: 50 }}
          color={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}
          renderOrder={0}
        />
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      const color = geom.attributes.color as THREE.BufferAttribute;
      expect(color.getX(0)).toBeCloseTo(0.25, 5);
    });
  });

  describe('texture StyleBox kind', () => {
    const TEX = 'res://stylebox-quad-test.png';
    const SCOPE = { externalResources: [{ id: '1', type: 'Texture2D', path: TEX }], internalResources: [] };

    function textureBox(overrides: Partial<StyleBoxTextureBox['texture']> = {}): StyleBoxTextureBox {
      return {
        ...box({}),
        styleBoxKind: 'texture',
        texture: {
          texture: 'ExtResource("1")',
          resources: SCOPE,
          margin: { left: 0, top: 0, right: 0, bottom: 0 },
          contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
          expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
          regionRect: undefined,
          axisStretchHorizontal: 0,
          axisStretchVertical: 0,
          drawCenter: true,
          modulateColor: { r: 1, g: 1, b: 1, a: 1 },
          ...overrides,
        },
      };
    }

    function fakeTexture(): THREE.Texture {
      const tex = new THREE.Texture();
      (tex as unknown as { image: { width: number; height: number } }).image = { width: 20, height: 20 };
      return tex;
    }

    it("draws a textured nine-patch mesh once the box's texture resolves", async () => {
      const fake = createFakeResourceLoader();
      fake.textures.seed(TEX, fakeTexture());
      const renderer = await ReactThreeTestRenderer.create(
        <ResourceLoaderProvider loader={fake.loader}>
          <StyleBoxQuad styleBox={textureBox()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
        </ResourceLoaderProvider>
      );
      const mesh = renderer.scene.findByType('Mesh').instance as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      expect(mat.map).toBeTruthy();
      expect(mesh.geometry.attributes.uv).toBeTruthy();
    });

    it('grows the drawn rect by expand_margin (StyleBoxTexture::draw)', async () => {
      const fake = createFakeResourceLoader();
      fake.textures.seed(TEX, fakeTexture());
      const renderer = await ReactThreeTestRenderer.create(
        <ResourceLoaderProvider loader={fake.loader}>
          <StyleBoxQuad
            styleBox={textureBox({ expandMargin: { left: 5, top: 0, right: 0, bottom: 0 } })}
            rect={{ x: 0, y: 0, w: 100, h: 50 }}
            renderOrder={0}
          />
        </ResourceLoaderProvider>
      );
      const geom = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
      geom.computeBoundingBox();
      expect(geom.boundingBox!.min.x).toBeCloseTo(-5);
    });

    it('renders nothing while the texture has not resolved yet', async () => {
      const fake = createFakeResourceLoader();
      const renderer = await ReactThreeTestRenderer.create(
        <ResourceLoaderProvider loader={fake.loader}>
          <StyleBoxQuad styleBox={textureBox()} rect={{ x: 0, y: 0, w: 100, h: 50 }} renderOrder={0} />
        </ResourceLoaderProvider>
      );
      expect(() => renderer.scene.findByType('Mesh')).toThrow();
    });
  });
});

/**
 * The 2D shadow pass, end to end through the real dispatcher.
 *
 * Every expected value here is derived from Godot's own sources, not from a
 * reference image:
 *
 *   drivers/gles3/shaders/canvas.glsl, light_compute
 *     shadow_color.a *= light_color.a;
 *     light_color = mix(light_color, shadow_color, shadow);
 *
 * so a fully shadowed pixel takes `light_color = vec4(shadow_color.rgb,
 * shadow_color.a * cookie.a)` — the light's own colour and energy drop out
 * entirely — and with `Light2D`'s default `shadow_color = Color(0, 0, 0, 0)`
 * the whole term vanishes and the surface keeps the value it had unlit.
 *
 *   servers/rendering/renderer_canvas_cull.cpp, _light_find_shadow
 *     an occluder casts only while `occluder_light_mask & shadow_item_cull_mask`
 *     is non-zero, and only while it is visible in the tree.
 *
 * Those are stencil geometry, blend state and uniforms — all observable without
 * a GPU. The PIXELS are measured against the engine by the
 * `unit-lightoccluder2d-*` sheets and pinned by their goldens.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider, LIGHT_LAYER } from './CanvasLighting2D';
import {
  litQuadRenderOrder,
  shadowStencilRef,
  shadowVolumeRenderOrder,
} from './ShadowVolumeMask';
import '../nodes'; // side-effect: registers every node's r3f component

const COOKIE = 'res://light.png';

/** A vertical bar 200 px tall, as an OPEN two-point occluder polygon. */
const BAR = `
[sub_resource type="OccluderPolygon2D" id="bar"]
closed = false
polygon = PackedVector2Array(0, -100, 0, 100)
`;

function scene(body: string, subResources = BAR): string {
  return `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
${subResources}
[node name="Root" type="Node2D"]
[node name="Surface" type="Polygon2D" parent="."]
color = Color(0.25, 0.25, 0.25, 1)
polygon = PackedVector2Array(0, 0, 1152, 0, 1152, 648, 0, 648)
${body}`;
}

function lamp(name: string, x: number, extra = ''): string {
  return `
[node name="${name}" type="PointLight2D" parent="."]
position = Vector2(${x}, 324)
texture = ExtResource("1")
shadow_enabled = true
${extra}`;
}

function caster(name: string, x: number, extra = ''): string {
  return `
[node name="${name}" type="LightOccluder2D" parent="."]
position = Vector2(${x}, 324)
${extra}occluder = SubResource("bar")
`;
}

async function render(tscn: string) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const cookie = new THREE.Texture();
  // 1024 px square, so a default `texture_scale` cookie reaches ±512 px and the
  // occluders below sit inside the light's cull rect.
  (cookie as unknown as { image: { width: number; height: number } }).image = {
    width: 1024,
    height: 1024,
  };
  fake.textures.seed(COOKIE, cookie);

  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
              <NodeDispatcher nodes={parsed.nodes} />
            </CanvasLighting2DProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  // No frame is advanced: the world matrices are sampled in a layout effect
  // as well, so a still tree settles inside React's own commit loop. Driving
  // the loop here would also run the accumulation pre-pass, which needs a real
  // GL context that happy-dom does not have.
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

function meshes(renderer: Rendered): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh);
}

/** The stencil masks: colour writes off, stencil op REPLACE. */
function maskMeshes(renderer: Rendered): THREE.Mesh[] {
  return meshes(renderer).filter((mesh) => {
    const material = mesh.material as THREE.Material;
    return material.colorWrite === false && material.stencilWrite === true;
  });
}

/** The cookie quads, in scene order. */
function lightQuads(renderer: Rendered): THREE.Mesh[] {
  return meshes(renderer).filter(
    (mesh) => !!(mesh.material as THREE.ShaderMaterial).uniforms?.uCookie
  );
}

/** The lit halves — the quads that carry the light's own colour. */
function litQuads(renderer: Rendered): THREE.Mesh[] {
  return lightQuads(renderer).filter(
    (mesh) => !!(mesh.material as THREE.ShaderMaterial).uniforms?.uColor
  );
}

describe('a shadow-enabled light with an occluder in range', () => {
  it('stamps one stencil mask on the light class layer', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const masks = maskMeshes(renderer);
    expect(masks).toHaveLength(1);

    const probe = new THREE.Layers();
    probe.set(LIGHT_LAYER);
    expect(masks[0]!.layers.test(probe)).toBe(true);
  });

  it('draws the mask immediately before the quad it belongs to', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    expect(maskMeshes(renderer)[0]!.renderOrder).toBe(shadowVolumeRenderOrder(0));
    expect(litQuads(renderer)[0]!.renderOrder).toBe(litQuadRenderOrder(0));
  });

  it('makes the quad reject exactly what the mask stamped', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const mask = maskMeshes(renderer)[0]!.material as THREE.Material;
    const quad = litQuads(renderer)[0]!.material as THREE.Material;

    expect(mask.stencilRef).toBe(shadowStencilRef(0));
    expect(mask.stencilZPass).toBe(THREE.ReplaceStencilOp);
    expect(quad.stencilWrite).toBe(true);
    expect(quad.stencilRef).toBe(shadowStencilRef(0));
    expect(quad.stencilFunc).toBe(THREE.NotEqualStencilFunc);
  });

  it('emits the volumes in world space, under a transformed ancestor', async () => {
    // The mask's vertices are world coordinates; inheriting the light's own
    // CanvasItem transform would apply that transform twice.
    const renderer = await render(
      `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
${BAR}
[node name="Root" type="Node2D"]
[node name="Shifted" type="Node2D" parent="."]
position = Vector2(300, 90)
[node name="Lamp" type="PointLight2D" parent="Shifted"]
position = Vector2(100, 234)
texture = ExtResource("1")
shadow_enabled = true
[node name="Caster" type="LightOccluder2D" parent="Shifted"]
position = Vector2(276, 234)
occluder = SubResource("bar")
`
    );
    const mask = maskMeshes(renderer)[0]!;
    expect(mask.matrixWorldAutoUpdate).toBe(false);
    expect(mask.matrixWorld.elements).toEqual(new THREE.Matrix4().elements);
  });
});

describe('what does not cast', () => {
  it('casts nothing when shadow_enabled is left off', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400, 'shadow_enabled = false\n')}${caster('Caster', 576)}`)
    );
    expect(maskMeshes(renderer)).toHaveLength(0);
    // …and the quad must not stencil-test either, or it would depend on a
    // buffer nothing in the pass writes.
    expect((litQuads(renderer)[0]!.material as THREE.Material).stencilWrite).toBe(false);
  });

  it('casts nothing with no occluder on the canvas', async () => {
    const renderer = await render(scene(lamp('Lamp', 400)));
    expect(maskMeshes(renderer)).toHaveLength(0);
  });

  it('casts nothing when occluder_light_mask misses shadow_item_cull_mask', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400)}${caster('Caster', 576, 'occluder_light_mask = 2\n')}`)
    );
    expect(maskMeshes(renderer)).toHaveLength(0);
  });

  it('casts from an occluder that shares ANY bit with the light', async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'shadow_item_cull_mask = 6\n')}` +
          `${caster('Caster', 576, 'occluder_light_mask = 12\n')}`
      )
    );
    expect(maskMeshes(renderer)).toHaveLength(1);
  });

  it('casts nothing from a hidden occluder', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400)}${caster('Caster', 576, 'visible = false\n')}`)
    );
    expect(maskMeshes(renderer)).toHaveLength(0);
  });

  it('casts nothing from an occluder outside the light rect', async () => {
    // The cookie is 1024 px wide at texture_scale 1, so a light at x=100 reaches
    // to x=612 and an occluder at x=1100 is culled — Godot's own rect test.
    const renderer = await render(scene(`${lamp('Lamp', 100)}${caster('Caster', 1100)}`));
    expect(maskMeshes(renderer)).toHaveLength(0);
  });
});

describe('two shadowed lights in one pass', () => {
  const TWO = scene(`${lamp('Warm', 380)}${lamp('Cool', 772)}${caster('Caster', 576)}`);

  it('gives each light its own stencil ref', async () => {
    // A shared ref of 1 makes the SECOND light reject every pixel the first
    // shadowed, which reads as "shadows too dark" and points nowhere near the
    // stencil. Distinctness is the whole fix.
    const renderer = await render(TWO);
    const refs = maskMeshes(renderer).map((mesh) => (mesh.material as THREE.Material).stencilRef);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
  });

  it('finishes each light before the next one stamps', async () => {
    // The pass replays mask, quad, mask, quad — nothing of light B's may fall
    // between light A's stamp and light A's quad, or A would read B's stencil.
    const renderer = await render(TWO);
    const masks = maskMeshes(renderer).map((mesh) => ({ mesh, kind: 'mask' as const }));
    const quads = litQuads(renderer).map((mesh) => ({ mesh, kind: 'quad' as const }));
    expect(quads).toHaveLength(2);

    const drawn = [...masks, ...quads].sort((a, b) => a.mesh.renderOrder - b.mesh.renderOrder);
    expect(drawn.map((entry) => entry.kind)).toEqual(['mask', 'quad', 'mask', 'quad']);
    for (let i = 0; i < drawn.length; i += 2) {
      const stamp = drawn[i]!.mesh.material as THREE.Material;
      const reads = drawn[i + 1]!.mesh.material as THREE.Material;
      expect(reads.stencilRef).toBe(stamp.stencilRef);
    }
  });

  it('numbers the lights densely from zero within their class', async () => {
    const renderer = await render(TWO);
    const orders = litQuads(renderer)
      .map((quad) => quad.renderOrder)
      .sort((a, b) => a - b);
    expect(orders).toEqual([litQuadRenderOrder(0), litQuadRenderOrder(1)]);
  });
});

describe('shadow_color', () => {
  it('adds a second quad covering exactly what the cookie quad skips', async () => {
    // Godot's shadow term is `mix(light_color, shadow_color, shadow)` applied
    // AFTER `light_color.rgb *= base_color.rgb`, so an authored shadow_color
    // lands on the canvas WITHOUT the item's albedo — measured on two surfaces
    // (0.25 and 0.75) inside one shadow at equal distance from the light, which
    // read rgb(78,99,167) and rgb(207,228,255): a constant 129 apart per
    // channel, where an albedo-scaled term would differ by 135 and 146.
    //
    // So the term rides its own albedo-free accumulator, and the two quads
    // partition the light's rect: NotEqual for the cookie, Equal for the tint.
    const authored = await render(
      scene(
        `${lamp('Lamp', 400, 'shadow_color = Color(0.15, 0.35, 1, 1)\n')}${caster('Caster', 576)}`
      )
    );
    expect(maskMeshes(authored)).toHaveLength(1);

    const material = litQuads(authored)[0]!.material as THREE.Material;
    expect(material.stencilRef).toBe(shadowStencilRef(0));
    expect(material.stencilFunc).toBe(THREE.NotEqualStencilFunc);

    const tint = lightQuads(authored)
      .map((quad) => quad.material as THREE.Material)
      .find((mat) => mat.stencilFunc === THREE.EqualStencilFunc);
    expect(tint?.stencilRef).toBe(shadowStencilRef(0));
  });

  it('draws no tint quad at the transparent default', async () => {
    // Godot defaults shadow_color to Color(0, 0, 0, 0). Withholding the cookie
    // is then the entire shadow, and the extra pass is never allocated.
    const plain = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const tinted = lightQuads(plain)
      .map((quad) => quad.material as THREE.Material)
      .filter((mat) => mat.stencilFunc === THREE.EqualStencilFunc);
    expect(tinted).toHaveLength(0);
  });

  it('leaves an unshadowed light alone however shadow_color is set', async () => {
    const renderer = await render(
      scene(lamp('Lamp', 400, 'shadow_color = Color(0.15, 0.35, 1, 1)\n'))
    );
    expect(lightQuads(renderer)).toHaveLength(1);
    expect((litQuads(renderer)[0]!.material as THREE.Material).stencilWrite).toBe(false);
  });
});

/**
 * `shadow_filter` picks the MECHANISM, not a parameter of one.
 *
 *   drivers/gles3/shaders/canvas.glsl, light_shadow_compute
 *     NONE  : one SHADOW_TEST       -> shadow is 0 or 1
 *     PCF5  : five taps / 5.0       -> a fraction with five steps
 *     PCF13 : thirteen taps / 13.0
 *
 * A stencil is binary by construction, so only NONE is expressible as one. The
 * gate below is what keeps the measured-at-parity stencil path untouched for
 * every scene that leaves the property at its default.
 */
describe('shadow_filter selects the shadow mechanism', () => {
  /** The light's polar map, wherever in the tree its quad ended up. */
  function shadowMap(renderer: Rendered): THREE.DataTexture | undefined {
    return lightQuads(renderer)
      .map((quad) => (quad.material as THREE.ShaderMaterial).uniforms.uShadowMap?.value)
      .find(Boolean) as THREE.DataTexture | undefined;
  }

  it('keeps the stencil mechanism at the NONE default', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    expect(maskMeshes(renderer)).toHaveLength(1);
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.stencilWrite).toBe(true);
    expect(material.uniforms.uShadowMap).toBeUndefined();
    expect(material.defines?.SHADOW_FILTER).toBeUndefined();
  });

  it('replaces it with the polar map under PCF5, stamping no stencil at all', async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'shadow_filter = 1\nshadow_filter_smooth = 8.0\n')}${caster('Caster', 576)}`
      )
    );
    expect(maskMeshes(renderer)).toHaveLength(0);

    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.stencilWrite).toBeFalsy();
    expect(material.defines?.SHADOW_FILTER).toBe(1);
    expect(material.uniforms.uShadowMap!.value).toBeInstanceOf(THREE.DataTexture);
    // rasterizer_canvas_gles3.cpp:182 — (1 / 2048) * (1 + shadow_smooth).
    expect(material.uniforms.uShadowPixelSize!.value).toBe(9 / 2048);
    // renderer_viewport.cpp:485,556 — z_far is radius_cache * 1.1, and
    // radius_cache is the 1024x1024 cookie rect's diagonal.
    expect(material.uniforms.uShadowZFarInv!.value).toBeCloseTo(1 / (1024 * Math.SQRT2 * 1.1), 9);
  });

  it('takes the thirteen-tap kernel under PCF13', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400, 'shadow_filter = 2\n')}${caster('Caster', 576)}`)
    );
    expect(maskMeshes(renderer)).toHaveLength(0);
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.defines?.SHADOW_FILTER).toBe(2);
  });

  it('carves the map from the same occluders the volumes would have used', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400, 'shadow_filter = 1\n')}${caster('Caster', 576)}`)
    );
    const data = shadowMap(renderer)!.image.data as Uint16Array;
    const occluded = [...data].filter((half) => THREE.DataUtils.fromHalfFloat(half) < 1);
    // The bar subtends a real arc from a light 176 px away, so the map is
    // neither empty nor saturated.
    expect(occluded.length).toBeGreaterThan(0);
    expect(occluded.length).toBeLessThan(data.length);
  });

  it('leaves a filtered light with no occluders on the unshadowed material', async () => {
    const renderer = await render(scene(lamp('Lamp', 400, 'shadow_filter = 1\n')));
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uShadowMap).toBeUndefined();
    expect(material.stencilWrite).toBe(false);
  });

  it('carries an authored shadow_color through the filter, without a stencil', async () => {
    // The `mix` expands to two terms with no cross term, so the tint keeps its
    // own albedo-free quad — it just computes its own fraction instead of being
    // stencilled into the umbra. Note the tint quad exists at all only because
    // `shadowColorContributes` gates on `shadow_color.a > 0`.
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'shadow_filter = 1\nshadow_color = Color(0.15, 0.35, 1, 1)\n')}${caster('Caster', 576)}`
      )
    );
    expect(maskMeshes(renderer)).toHaveLength(0);

    const tint = lightQuads(renderer)
      .map((quad) => quad.material as THREE.ShaderMaterial)
      .find((mat) => !mat.uniforms.uColor);
    expect(tint).toBeDefined();
    expect(tint!.defines?.SHADOW_FILTER).toBe(1);
    expect(tint!.stencilWrite).toBeFalsy();
    // One map, two consumers: a second build would be a second chance to drift.
    expect(tint!.uniforms.uShadowMap!.value).toBe(shadowMap(renderer));
  });
});

/**
 * The 2D shadow pass, end to end through the real dispatcher. Expected values
 * come from Godot's sources and are read as stencil geometry, blend state and
 * uniforms, with no GPU. The `unit-lightoccluder2d-*` goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider } from './CanvasLighting2D';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import { itemUniforms, ownerName, recordLightPass, type RecordedDraw } from './testing/lightPassProbe';
import { litQuadRenderOrder, shadowStencilRef, shadowVolumeRenderOrder } from './ShadowVolumeMask';
import { SceneStack } from '../testing/SceneStack';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
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

/** A second full-canvas surface, for the items a light_mask other than the default selects. */
function surface(name: string, lightMask: number): string {
  return `
[node name="${name}" type="Polygon2D" parent="."]
light_mask = ${lightMask}
color = Color(0.25, 0.25, 0.25, 1)
polygon = PackedVector2Array(0, 0, 1152, 0, 1152, 648, 0, 648)`;
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
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(parsed), panelId: 'p' }}>
        <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
          <NodeDispatcher nodes={parsed.nodes} />
        </CanvasLighting2DProvider>
      </HierarchyProvider>
    </SceneStack>
  );
  // No frame is advanced: the world matrices are sampled in a layout effect
  // as well, so a still tree settles inside React's own commit loop.
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
  return meshes(renderer).filter((mesh) => !!(mesh.material as THREE.ShaderMaterial).uniforms?.uCookie);
}

/** The meshes the pass draws into the buffer `uniform` of the item named `name` binds. */
async function drawnFor(renderer: Rendered, name: string, uniform: string): Promise<THREE.Mesh[]> {
  const texture = itemUniforms(renderer, name)[uniform]!.value as THREE.Texture;
  const draws: RecordedDraw[] = await recordLightPass(renderer);
  return (
    draws.find((draw) => draw.texture === texture)?.drawn.filter((mesh) => ownerName(mesh) === 'Lamp') ?? []
  );
}

/** The lit halves: the quads that carry the light's own colour. */
function litQuads(renderer: Rendered): THREE.Mesh[] {
  return lightQuads(renderer).filter((mesh) => !!(mesh.material as THREE.ShaderMaterial).uniforms?.uColor);
}

describe('a shadow-enabled light with an occluder in range', () => {
  it('stamps one stencil mask on the light pass layer alone', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const masks = maskMeshes(renderer);
    expect(masks).toHaveLength(1);
    expect(masks[0]!.layers.mask).toBe(1 << LIGHT_PASS_LAYER);
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

// `servers/rendering/renderer_canvas_cull.cpp`, `_light_find_shadow`: an occluder
// casts only while `occluder_light_mask & shadow_item_cull_mask` is non-zero and
// it is visible in the tree.
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
        `${lamp('Lamp', 400, 'range_item_cull_mask = 2\nshadow_item_cull_mask = 6\n')}` +
          `${caster('Caster', 576, 'occluder_light_mask = 12\n')}`
      )
    );
    expect(maskMeshes(renderer)).toHaveLength(1);
  });

  it('casts nothing from a hidden occluder', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576, 'visible = false\n')}`));
    expect(maskMeshes(renderer)).toHaveLength(0);
  });

  it('casts nothing from an occluder outside the light rect', async () => {
    // The cookie is 1024 px wide at texture_scale 1, so a light at x=100 reaches
    // to x=612 and Godot's rect test culls an occluder at x=1100.
    const renderer = await render(scene(`${lamp('Lamp', 100)}${caster('Caster', 1100)}`));
    expect(maskMeshes(renderer)).toHaveLength(0);
  });
});

describe('two shadowed lights in one pass', () => {
  const TWO = scene(`${lamp('Warm', 380)}${lamp('Cool', 772)}${caster('Caster', 576)}`);

  it('gives each light its own stencil ref', async () => {
    // A shared ref of 1 makes the second light reject every pixel the first
    // shadowed, which reads as "shadows too dark".
    const renderer = await render(TWO);
    const refs = maskMeshes(renderer).map((mesh) => (mesh.material as THREE.Material).stencilRef);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2);
  });

  it('finishes each light before the next one stamps', async () => {
    // The pass replays mask, quad, mask, quad: nothing of light B's may fall
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

  it('numbers the lights densely from zero on the canvas', async () => {
    const renderer = await render(TWO);
    const orders = litQuads(renderer)
      .map((quad) => quad.renderOrder)
      .sort((a, b) => a - b);
    expect(orders).toEqual([litQuadRenderOrder(0), litQuadRenderOrder(1)]);
  });
});

/**
 * `drivers/gles3/shaders/canvas.glsl`, `light_compute`: a fully shadowed pixel takes
 * `shadow_color`, and the default `Color(0, 0, 0, 0)` leaves the surface unlit.
 *
 *     shadow_color.a *= light_color.a;
 *     light_color = mix(light_color, shadow_color, shadow);
 */
describe('shadow_color', () => {
  const TINT = 'shadow_color = Color(0.15, 0.35, 1, 1)\n';

  it('adds a second quad covering exactly what the cookie quad skips', async () => {
    // The `mix` runs after `light_color.rgb *= base_color.rgb`, so shadow_color
    // lands without the item's albedo. Measured: surfaces 0.25 and 0.75 in one
    // shadow read rgb(78,99,167) and rgb(207,228,255), 129 apart per channel,
    // where an albedo-scaled term differs by 135 and 146.
    const authored = await render(
      scene(`${lamp('Lamp', 400, 'shadow_color = Color(0.15, 0.35, 1, 1)\n')}${caster('Caster', 576)}`)
    );
    expect(maskMeshes(authored)).toHaveLength(1);

    // The term rides its own albedo-free accumulator, and the two quads
    // partition the light's rect: NotEqual for the cookie, Equal for the tint.
    const material = litQuads(authored)[0]!.material as THREE.Material;
    expect(material.stencilRef).toBe(shadowStencilRef(0));
    expect(material.stencilFunc).toBe(THREE.NotEqualStencilFunc);

    const tint = lightQuads(authored)
      .map((quad) => quad.material as THREE.Material)
      .find((mat) => mat.stencilFunc === THREE.EqualStencilFunc);
    expect(tint?.stencilRef).toBe(shadowStencilRef(0));
  });

  /** Surface (mask 1) takes Plain alone. Lit2 (mask 2) takes Tinting, which shadows it. */
  const PLAIN_AND_TINTING = scene(
    `${surface('Lit2', 2)}${lamp('Plain', 300, 'range_item_cull_mask = 1\n')}` +
      `${lamp('Lamp', 700, `range_item_cull_mask = 2\nshadow_item_cull_mask = 2\n${TINT}`)}` +
      `${caster('Caster', 500, 'occluder_light_mask = 3\n')}`
  );

  it('draws the volumes and the tint quad into the shadow_color buffer of the list it shadows', async () => {
    const renderer = await render(PLAIN_AND_TINTING);
    const drawn = await drawnFor(renderer, 'Lit2', 'uShadowTint');
    expect(drawn.map((mesh) => (mesh.material as THREE.Material).stencilFunc)).toEqual([
      THREE.AlwaysStencilFunc,
      THREE.EqualStencilFunc,
    ]);
  });

  it('gives a list no tinting light shadows no shadow_color buffer', async () => {
    // A `shadow_color` buffer no pass draws would read as black, the same as none, so the
    // binding is checked against the draws.
    const renderer = await render(PLAIN_AND_TINTING);
    const tint = itemUniforms(renderer, 'Surface').uShadowTint!.value as THREE.Texture;
    const draws = await recordLightPass(renderer);
    expect(draws.some((draw) => draw.texture === tint)).toBe(false);
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
    const renderer = await render(scene(lamp('Lamp', 400, 'shadow_color = Color(0.15, 0.35, 1, 1)\n')));
    expect(lightQuads(renderer)).toHaveLength(1);
    expect((litQuads(renderer)[0]!.material as THREE.Material).stencilWrite).toBe(false);
  });
});

/**
 * `light_blend_compute` applies a light's whole `light_color` with one alpha. The pass splits that
 * term over the light and tint buffers, so each light writes both over its whole reach with that
 * alpha: a MIX light then scales the colour under it in both, as Godot scales one colour.
 */
describe('one alpha over both buffers', () => {
  const TINT = 'shadow_color = Color(0.15, 0.35, 1, 1)\n';
  const MIX = 'blend_mode = 2\n';
  /** Tint, a tinting light, gives Surface's list a shadow_color buffer. Lamp is the light under test. */
  const withTint = (lampExtra: string, x = 700) =>
    scene(`${lamp('Tint', 300, TINT)}${lamp('Lamp', x, lampExtra)}${caster('Caster', 576)}`);

  function stencilFuncs(drawn: readonly THREE.Mesh[]): number[] {
    return drawn.map((mesh) => (mesh.material as THREE.Material).stencilFunc);
  }

  function colourOf(mesh: THREE.Mesh): number[] {
    const { uColor, uShadowColor } = (mesh.material as THREE.ShaderMaterial).uniforms;
    const colour = (uColor ?? uShadowColor)!.value as THREE.Vector3;
    return [colour.x, colour.y, colour.z];
  }

  it("adds a tinting light's shadow_color alpha to the light buffer, colourless, where it is blocked", async () => {
    // Godot sums the alpha into `light_only_alpha` and MIX scales the colour under it by it.
    const renderer = await render(scene(`${lamp('Lamp', 400, `${MIX}${TINT}`)}${caster('Caster', 576)}`));
    const drawn = await drawnFor(renderer, 'Surface', 'uLightList');
    expect(stencilFuncs(drawn)).toEqual([
      THREE.AlwaysStencilFunc,
      THREE.NotEqualStencilFunc,
      THREE.EqualStencilFunc,
    ]);
    const shade = (drawn[2]!.material as THREE.ShaderMaterial).uniforms.uShadowColor!.value as THREE.Vector4;
    expect([shade.x, shade.y, shade.z, shade.w]).toEqual([0, 0, 0, 1]);
  });

  it('scales the shadow_color under a MIX light by its alpha, colourless, where it is lit', async () => {
    const renderer = await render(withTint(MIX));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(stencilFuncs(drawn)).toEqual([THREE.AlwaysStencilFunc, THREE.NotEqualStencilFunc]);
    expect(colourOf(drawn[1]!)).toEqual([0, 0, 0]);
  });

  it('scales it over the whole rect for a MIX light that casts nothing', async () => {
    const renderer = await render(withTint(`${MIX}shadow_enabled = false\n`, 900));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn.map((mesh) => (mesh.material as THREE.Material).stencilWrite)).toEqual([false]);
    expect(colourOf(drawn[0]!)).toEqual([0, 0, 0]);
  });

  it('scales it over the whole rect for a MIX light whose shadow misses the item', async () => {
    const renderer = await render(withTint(`${MIX}range_item_cull_mask = 3\nshadow_item_cull_mask = 2\n`));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn.map((mesh) => (mesh.material as THREE.Material).stencilWrite)).toEqual([false]);
    expect(colourOf(drawn[0]!)).toEqual([0, 0, 0]);
  });

  it("carries a filtered MIX light's alpha through its tint quad, untinted as it is", async () => {
    const renderer = await render(withTint(`${MIX}shadow_filter = 1\n`));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn).toHaveLength(1);
    expect((drawn[0]!.material as THREE.ShaderMaterial).uniforms.uShadowMap).toBeDefined();
  });

  it('draws no quad of an ADD light into the shadow_color buffer it adds nothing to', async () => {
    const renderer = await render(withTint(''));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn.filter((mesh) => (mesh.material as THREE.ShaderMaterial).uniforms?.uCookie)).toHaveLength(0);
  });

  it("tints a filtered light's penumbra with a transparent shadow_color's rgb", async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'shadow_filter = 1\nshadow_color = Color(1, 0, 0, 0)\n')}${caster('Caster', 576)}`
      )
    );
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn).toHaveLength(1);
  });
});

/**
 * `shadow_filter` picks the mechanism. In `drivers/gles3/shaders/canvas.glsl`,
 * `light_shadow_compute`, NONE takes one `SHADOW_TEST` (0 or 1), PCF5 five taps
 * over 5.0 and PCF13 thirteen over 13.0. Only NONE is binary, so only NONE keeps
 * the stencil path, which stays untouched at the default.
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
      scene(`${lamp('Lamp', 400, 'shadow_filter = 1\nshadow_filter_smooth = 8.0\n')}${caster('Caster', 576)}`)
    );
    expect(maskMeshes(renderer)).toHaveLength(0);

    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.stencilWrite).toBeFalsy();
    expect(material.defines?.SHADOW_FILTER).toBe(1);
    expect(material.uniforms.uShadowMap!.value).toBeInstanceOf(THREE.DataTexture);
    // rasterizer_canvas_gles3.cpp:182: (1 / 2048) * (1 + shadow_smooth).
    expect(material.uniforms.uShadowPixelSize!.value).toBe(9 / 2048);
    // renderer_viewport.cpp:485,556: z_far is radius_cache * 1.1, and
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
    // The `mix` has no cross term, so the tint keeps its own albedo-free quad and
    // computes its own fraction instead of a stencilled umbra.
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

/**
 * `canvas.glsl:806`: a positional light shadows only the items whose `light_mask` meets its
 * `shadow_item_cull_mask` (`renderer_canvas_render_rd.cpp:2374`). The rest take it unshadowed, so
 * the pass draws the light's shadowless quad into the lists of those items.
 */
describe('shadow_item_cull_mask picks the items that take the shadow', () => {
  /** Surface keeps light_mask 1 and misses the shadow. Lit2 meets it, as the occluder does. */
  const ESCAPING = scene(
    `${surface('Lit2', 2)}${lamp('Lamp', 400, 'range_item_cull_mask = 3\nshadow_item_cull_mask = 2\n')}` +
      `${caster('Caster', 576, 'occluder_light_mask = 2\n')}`
  );

  it('draws the volumes and the stencilled quad for an item that meets the mask', async () => {
    const renderer = await render(ESCAPING);
    const drawn = await drawnFor(renderer, 'Lit2', 'uLightList');
    expect(drawn.map((mesh) => (mesh.material as THREE.Material).stencilFunc)).toEqual([
      THREE.AlwaysStencilFunc,
      THREE.NotEqualStencilFunc,
    ]);
  });

  it('draws only the quad without a stencil test for an item that misses the mask', async () => {
    const renderer = await render(ESCAPING);
    const drawn = await drawnFor(renderer, 'Surface', 'uLightList');
    expect(drawn.map((mesh) => (mesh.material as THREE.Material).stencilWrite)).toEqual([false]);
  });

  it('builds no unshadowed quad while every item the light reaches takes the shadow', async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'range_item_cull_mask = 2\nshadow_item_cull_mask = 2\n')}` +
          `${caster('Caster', 576, 'occluder_light_mask = 2\n')}`
      )
    );
    expect(litQuads(renderer)).toHaveLength(1);
  });

  it('casts nothing while no item the light reaches meets the shadow mask', async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'range_item_cull_mask = 1\nshadow_item_cull_mask = 2\n')}` +
          `${caster('Caster', 576, 'occluder_light_mask = 2\n')}`
      )
    );
    expect(maskMeshes(renderer)).toHaveLength(0);
    expect(litQuads(renderer)).toHaveLength(1);
  });

  it('builds no unshadowed quad while the light has no occluder to cast from', async () => {
    const renderer = await render(
      scene(lamp('Lamp', 400, 'range_item_cull_mask = 3\nshadow_item_cull_mask = 2\n'))
    );
    expect(litQuads(renderer)).toHaveLength(1);
  });
});

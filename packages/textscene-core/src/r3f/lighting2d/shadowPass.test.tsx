/**
 * The 2D shadow pass, end to end through the real dispatcher. Expected values
 * come from Godot's sources and are read as shadow maps, blend state and
 * uniforms, with no GPU. The `unit-lightoccluder2d-*` goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { LIGHT_PASS_LAYER } from './lightPassLayers';
import { itemUniforms, ownerName, recordLightPass, type RecordedDraw } from './testing/lightPassProbe';
import { DispatchedScene } from '../testing/DispatchedScene';
import { underWhiteCanvasLighting } from './testing/whiteCanvasLighting';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { settleLoads } from '../testing/settleLoads';
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
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(parsed)}
      loader={fake.loader}
      workspace="2d"
      around={underWhiteCanvasLighting}
    />
  );
  // No frame is advanced: the world matrices are sampled in a layout effect
  // as well, so a still tree settles inside React's own commit loop.
  await settleLoads();
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

function meshes(renderer: Rendered): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh);
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

/** The `shadow_color` quads: the ones without the light's colour. */
function tintQuads(renderer: Rendered): THREE.ShaderMaterial[] {
  return lightQuads(renderer)
    .map((quad) => quad.material as THREE.ShaderMaterial)
    .filter((material) => !material.uniforms.uColor);
}

/** The polar map a mesh's material samples, or undefined for an unshadowed one. */
function mapOf(mesh: THREE.Mesh): THREE.DataTexture | undefined {
  return (mesh.material as THREE.ShaderMaterial).uniforms.uShadowMap?.value as THREE.DataTexture | undefined;
}

/** The node object a mesh belongs to: its nearest named ancestor. */
function namedOwner(mesh: THREE.Object3D): THREE.Object3D {
  let object: THREE.Object3D = mesh;
  while (!object.name && object.parent) object = object.parent;
  return object;
}

/** The first light's polar map, or undefined while it casts nothing. */
function shadowMap(renderer: Rendered): THREE.DataTexture | undefined {
  return litQuads(renderer).map(mapOf).find(Boolean);
}

/** The bins of a map an occluder fills: the ones short of the far plane. */
function occludedBins(map: THREE.DataTexture): number[] {
  const bins = map.image.data as Float32Array;
  return [...bins.keys()].filter((bin) => bins[bin]! < 1);
}

describe('a shadow-enabled light with an occluder in range', () => {
  it('samples its polar map on the light pass layer alone', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const quad = litQuads(renderer)[0]!;
    expect(mapOf(quad)).toBeInstanceOf(THREE.DataTexture);
    expect(quad.layers.mask).toBe(1 << LIGHT_PASS_LAYER);
  });

  it('builds the map in world space, under a transformed ancestor', async () => {
    // The light-local frame takes the whole CanvasItem chain once: the same light and occluder
    // under a shifted parent fill the same bins.
    const shifted = await render(
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
    const plain = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    expect(occludedBins(shadowMap(shifted)!)).toEqual(occludedBins(shadowMap(plain)!));
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
    expect(shadowMap(renderer)).toBeUndefined();
  });

  it('casts nothing with no occluder on the canvas', async () => {
    const renderer = await render(scene(lamp('Lamp', 400)));
    expect(shadowMap(renderer)).toBeUndefined();
  });

  it('casts nothing when occluder_light_mask misses shadow_item_cull_mask', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400)}${caster('Caster', 576, 'occluder_light_mask = 2\n')}`)
    );
    expect(shadowMap(renderer)).toBeUndefined();
  });

  it('casts from an occluder that shares ANY bit with the light', async () => {
    const renderer = await render(
      scene(
        `${lamp('Lamp', 400, 'range_item_cull_mask = 2\nshadow_item_cull_mask = 6\n')}` +
          `${caster('Caster', 576, 'occluder_light_mask = 12\n')}`
      )
    );
    expect(shadowMap(renderer)).toBeDefined();
  });

  it('casts nothing from a hidden occluder', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576, 'visible = false\n')}`));
    expect(shadowMap(renderer)).toBeUndefined();
  });

  it('casts nothing from an occluder outside the light rect', async () => {
    // The cookie is 1024 px wide at texture_scale 1, so a light at x=100 reaches
    // to x=612 and Godot's rect test culls an occluder at x=1100.
    const renderer = await render(scene(`${lamp('Lamp', 100)}${caster('Caster', 1100)}`));
    expect(occludedBins(shadowMap(renderer)!)).toEqual([]);
  });
});

describe('two shadowed lights in one pass', () => {
  const TWO = scene(`${lamp('Warm', 380)}${lamp('Cool', 772)}${caster('Caster', 576)}`);

  it('gives each light its own map', async () => {
    const renderer = await render(TWO);
    const maps = litQuads(renderer).map(mapOf);
    expect(maps).toHaveLength(2);
    expect(new Set(maps).size).toBe(2);
  });

  it('draws the lights in their canvas list order', async () => {
    const renderer = await render(TWO);
    const orders = litQuads(renderer)
      .map((quad) => quad.renderOrder)
      .sort((a, b) => a - b);
    expect(orders).toEqual([0, 1]);
  });
});

/**
 * `canvas.glsl:543-547`, `light_shadow_compute`: a fully shadowed pixel takes
 * `shadow_color`, and the default `Color(0, 0, 0, 0)` leaves the surface unlit.
 *
 *     shadow_color.a *= light_color.a;
 *     return mix(light_color, shadow_color, shadow);
 */
describe('shadow_color', () => {
  const TINT = 'shadow_color = Color(0.15, 0.35, 1, 1)\n';

  it("adds a tint quad that reads the cookie quad's own map", async () => {
    // The `mix` runs after `light_color.rgb *= base_color.rgb`, so shadow_color
    // lands without the item's albedo. Measured: surfaces 0.25 and 0.75 in one
    // shadow read rgb(78,99,167) and rgb(207,228,255), 129 apart per channel,
    // where an albedo-scaled term differs by 135 and 146.
    const renderer = await render(scene(`${lamp('Lamp', 400, TINT)}${caster('Caster', 576)}`));
    const tint = tintQuads(renderer);
    expect(tint).toHaveLength(1);
    // One map, two consumers: a second build would be a second chance to drift.
    expect(tint[0]!.uniforms.uShadowMap!.value).toBe(shadowMap(renderer));
  });

  /** Surface (mask 1) takes Plain alone. Lit2 (mask 2) takes Tinting, which shadows it. */
  const PLAIN_AND_TINTING = scene(
    `${surface('Lit2', 2)}${lamp('Plain', 300, 'range_item_cull_mask = 1\n')}` +
      `${lamp('Lamp', 700, `range_item_cull_mask = 2\nshadow_item_cull_mask = 2\n${TINT}`)}` +
      `${caster('Caster', 500, 'occluder_light_mask = 3\n')}`
  );

  it('draws the tint quad into the shadow_color buffer of the list it shadows', async () => {
    const renderer = await render(PLAIN_AND_TINTING);
    const drawn = await drawnFor(renderer, 'Lit2', 'uShadowTint');
    expect(drawn).toHaveLength(1);
    expect(mapOf(drawn[0]!)).toBeDefined();
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
    expect(tintQuads(plain)).toHaveLength(0);
  });

  it('leaves an unshadowed light alone however shadow_color is set', async () => {
    const renderer = await render(scene(lamp('Lamp', 400, TINT)));
    expect(lightQuads(renderer)).toHaveLength(1);
    expect(shadowMap(renderer)).toBeUndefined();
  });
});

/**
 * `light_blend_compute` (`canvas.glsl:549-562`) applies a light's whole `light_color` with one
 * alpha. The pass splits that term over the light and tint buffers, so each light writes both over
 * its whole reach with that alpha: a MIX light then scales the colour under it in both, as Godot
 * scales one colour.
 */
describe('one alpha over both buffers', () => {
  const TINT = 'shadow_color = Color(0.15, 0.35, 1, 1)\n';
  const MIX = 'blend_mode = 2\n';
  /** Tint, a tinting light, gives Surface's list a shadow_color buffer. Lamp is the light under test. */
  const withTint = (lampExtra: string, x = 700) =>
    scene(`${lamp('Tint', 300, TINT)}${lamp('Lamp', x, lampExtra)}${caster('Caster', 576)}`);

  function colourOf(mesh: THREE.Mesh): number[] {
    const { uColor, uShadowColor } = (mesh.material as THREE.ShaderMaterial).uniforms;
    const colour = (uColor ?? uShadowColor)!.value as THREE.Vector3;
    return [colour.x, colour.y, colour.z];
  }

  it("adds a tinting light's shadow_color alpha to the light buffer through its cookie quad", async () => {
    // Godot sums the alpha into `light_only_alpha` (`canvas.glsl:849`) and MIX scales the colour
    // under it by it (`:559-560`).
    const renderer = await render(scene(`${lamp('Lamp', 400, `${MIX}${TINT}`)}${caster('Caster', 576)}`));
    const drawn = await drawnFor(renderer, 'Surface', 'uLightList');
    expect(drawn).toHaveLength(1);
    expect((drawn[0]!.material as THREE.ShaderMaterial).fragmentShader).toContain(
      'cookie.a * (lit + s * uShadowColor.a)'
    );
  });

  it("carries a shadowed MIX light's alpha through its tint quad, untinted as it is", async () => {
    const renderer = await render(withTint(MIX));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn).toHaveLength(1);
    expect(mapOf(drawn[0]!)).toBeDefined();
  });

  it('scales it over the whole rect for a MIX light that casts nothing', async () => {
    const renderer = await render(withTint(`${MIX}shadow_enabled = false\n`, 900));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn.map(mapOf)).toEqual([undefined]);
    expect(colourOf(drawn[0]!)).toEqual([0, 0, 0]);
  });

  it('scales it over the whole rect for a MIX light whose shadow misses the item', async () => {
    const renderer = await render(withTint(`${MIX}range_item_cull_mask = 3\nshadow_item_cull_mask = 2\n`));
    const drawn = await drawnFor(renderer, 'Surface', 'uShadowTint');
    expect(drawn.map(mapOf)).toEqual([undefined]);
    expect(colourOf(drawn[0]!)).toEqual([0, 0, 0]);
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
 * `shadow_filter` picks the taps (`canvas.glsl:507-535`): NONE one nearest bin, PCF5 five taps over
 * 5.0 and PCF13 thirteen over 13.0, all on the one polar map.
 */
describe('shadow_filter selects the taps', () => {
  it('samples the polar map under NONE too, with no stencil', async () => {
    // `canvas.glsl:507-510`: NONE reads one nearest bin of the same map the PCF kernels read.
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.stencilWrite).toBeFalsy();
    expect(material.defines?.SHADOW_FILTER).toBe(0);
    expect(material.uniforms.uShadowMap!.value).toBeInstanceOf(THREE.DataTexture);
  });

  it('takes the five-tap kernel under PCF5, spaced by shadow_filter_smooth', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400, 'shadow_filter = 1\nshadow_filter_smooth = 8.0\n')}${caster('Caster', 576)}`)
    );
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.defines?.SHADOW_FILTER).toBe(1);
    // renderer_canvas_render_rd.cpp:629: (1 / shadow_texture_size) * (1 + shadow_smooth).
    expect(material.uniforms.uShadowSmooth!.value).toBe(8);
    // renderer_viewport.cpp:485,556: z_far is radius_cache * 1.1, and
    // radius_cache is the 1024x1024 cookie rect's diagonal.
    expect(material.uniforms.uShadowZFarInv!.value).toBeCloseTo(1 / (1024 * Math.SQRT2 * 1.1), 9);
  });

  it('takes the thirteen-tap kernel under PCF13', async () => {
    const renderer = await render(
      scene(`${lamp('Lamp', 400, 'shadow_filter = 2\n')}${caster('Caster', 576)}`)
    );
    const material = litQuads(renderer)[0]!.material as THREE.ShaderMaterial;
    expect(material.defines?.SHADOW_FILTER).toBe(2);
  });

  it('keeps its materials while it moves, and moves the transform they read', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const quad = litQuads(renderer)[0]!;
    const material = quad.material as THREE.ShaderMaterial;
    const worldToLight = material.uniforms.uWorldToLight!.value as THREE.Matrix3;
    expect(worldToLight.elements[6]).toBeCloseTo(-400, 6);

    namedOwner(quad).position.x += 50;
    await ReactThreeTestRenderer.act(async () => {
      renderer.advanceFrames(2, 1 / 60);
    });

    // A rebuilt ShaderMaterial is a shader program relink, on every frame a light moves.
    expect(litQuads(renderer)[0]!.material).toBe(material);
    expect(worldToLight.elements[6]).toBeCloseTo(-450, 6);
  });

  it('carves the map from the occluders in range', async () => {
    const renderer = await render(scene(`${lamp('Lamp', 400)}${caster('Caster', 576)}`));
    const occluded = occludedBins(shadowMap(renderer)!);
    // The bar subtends a real arc from a light 176 px away, so the map is
    // neither empty nor saturated.
    expect(occluded.length).toBeGreaterThan(0);
    expect(occluded.length).toBeLessThan(2048);
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

  it('draws the shadowed quad for an item that meets the mask', async () => {
    const renderer = await render(ESCAPING);
    const drawn = await drawnFor(renderer, 'Lit2', 'uLightList');
    expect(drawn).toHaveLength(1);
    expect(mapOf(drawn[0]!)).toBeDefined();
  });

  it('draws only the unshadowed quad for an item that misses the mask', async () => {
    const renderer = await render(ESCAPING);
    const drawn = await drawnFor(renderer, 'Surface', 'uLightList');
    expect(drawn.map(mapOf)).toEqual([undefined]);
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
    expect(shadowMap(renderer)).toBeUndefined();
    expect(litQuads(renderer)).toHaveLength(1);
  });

  it('builds no unshadowed quad while the light has no occluder to cast from', async () => {
    const renderer = await render(
      scene(lamp('Lamp', 400, 'range_item_cull_mask = 3\nshadow_item_cull_mask = 2\n'))
    );
    expect(litQuads(renderer)).toHaveLength(1);
  });
});

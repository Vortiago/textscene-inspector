import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { castingSun } from '../testing/castingSun';
import { AtlasOmniShadow } from '../positionalShadow/atlasOmniShadow';
import { AtlasSpotShadow } from '../positionalShadow/atlasSpotShadow';
import { holdPositionalShadowAtlas } from '../positionalShadow/shadowAtlasTarget';
import { FOG_LIGHT_TEXELS, FogLightKind, FogLightRows, FogLightTexel } from './fogLights';
import { fogLightUserData } from './fogLightDeclaration';
import { areaLightUserData } from '../areaLight/areaLightFalloff';

holdPositionalShadowAtlas({}, 4096);

/** A camera at (0, 3, 8) looking down -Z, as in `unit-world-environment-basic`. */
function camera(): THREE.PerspectiveCamera {
  const view = new THREE.PerspectiveCamera(75, 1, 0.05, 4000);
  view.position.set(0, 3, 8);
  view.updateMatrixWorld();
  return view;
}

/** Each light in a scene, with its world matrices current, as the fog reads them. */
function placed(...lights: THREE.Light[]): THREE.Light[] {
  const scene = new THREE.Scene();
  for (const light of lights) {
    scene.add(light);
    const target = (light as THREE.DirectionalLight | THREE.SpotLight).target;
    if (target) scene.add(target);
  }
  scene.updateMatrixWorld();
  return lights;
}

/** The rows `lights` pack into through the test camera. */
function packed(lights: THREE.Light[]): FogLightRows {
  const rows = new FogLightRows();
  rows.pack(lights, camera());
  return rows;
}

/** Texel `texel` of light row `row`. */
function texel(rows: FogLightRows, row: number, texel: number): number[] {
  const start = (row * FOG_LIGHT_TEXELS + texel) * 4;
  return Array.from(rows.data.subarray(start, start + 4));
}

/** A vector's components to six places, so a negative zero matches a zero. */
function expectDirection(actual: number[], expected: number[]): void {
  actual.forEach((component, axis) => expect(component).toBeCloseTo(expected[axis]!, 6));
}

function omni(): THREE.PointLight {
  const light = new THREE.PointLight(0xffffff, Math.PI, 60, 1);
  light.position.set(0, 8, 0);
  return light;
}

describe('FogLightRows.pack', () => {
  it('puts an omni light in view space with its range, decay and colour times energy', () => {
    const rows = packed(placed(omni()));

    expect(rows.count).toBe(1);
    expect(texel(rows, 0, 0)).toEqual([0, 5, -8, Math.fround(1 / 60)]);
    expect(texel(rows, 0, 1)).toEqual([Math.fround(Math.PI), Math.fround(Math.PI), Math.fround(Math.PI), 1]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.OMNI);
  });

  it('scales the colour by the declared fog energy', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.5 });

    const rows = packed(placed(light));

    expect(texel(rows, 0, 1)[0]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('leaves out a light whose fog energy is at or below 0.001', () => {
    const light = omni();
    light.userData = fogLightUserData({ energy: 0.001 });

    expect(packed(placed(light)).count).toBe(0);
  });

  it('leaves out a light under a hidden ancestor', () => {
    const hidden = new THREE.Group();
    hidden.visible = false;
    hidden.add(omni());
    const scene = new THREE.Scene();
    scene.add(hidden);
    scene.updateMatrixWorld();

    expect(packed(hidden.children as THREE.Light[]).count).toBe(0);
  });

  it('points a directional light towards itself, in view space', () => {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(0, 1, 0);
    sun.target.position.set(0, 0, 0);

    const rows = packed(placed(sun));

    expectDirection(texel(rows, 0, 2).slice(0, 3), [0, 1, 0]);
    expect(texel(rows, 0, 3)[1]).toBe(FogLightKind.DIRECTIONAL);
  });

  it("gives a spot light its travel direction, cone cosine and Godot's cone exponent", () => {
    const spot = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 3, 0, 1);
    spot.position.set(0, 3, 0);
    spot.target.position.set(0, 3, -1);
    spot.userData = fogLightUserData({ energy: 1, spotAngleAttenuation: 4 });

    const rows = packed(placed(spot));

    const [x, y, z, cosAngle] = texel(rows, 0, 2);
    expectDirection([x!, y!, z!], [0, 0, -1]);
    expect(cosAngle).toBeCloseTo(0.5, 6);
    expect(texel(rows, 0, 3)).toEqual([0.25, FogLightKind.SPOT, 0, 0]);
  });

  it('gives an area light its facing, rectangle, range, centre range and attenuation', () => {
    const area = new THREE.RectAreaLight(0xffffff, Math.PI, 2, 1);
    area.position.set(0, 8, 0);
    area.rotation.x = -Math.PI / 2;
    area.userData = areaLightUserData({ range: 6, attenuation: 3, specular: 1 });

    const rows = packed(placed(area));

    expect(texel(rows, 0, FogLightTexel.POSITION)).toEqual([0, 5, -8, Math.fround(1 / 6)]);
    // Godot hands the fog the attenuation less one (4.7.2 volumetric_fog_process.glsl:653).
    expect(texel(rows, 0, FogLightTexel.COLOR)[3]).toBe(2);
    const [x, y, z, inverseCentreRange] = texel(rows, 0, FogLightTexel.DIRECTION);
    expectDirection([x!, y!, z!], [0, -1, 0]);
    // 1 / (range + |area_size| / 2), 4.7.2 light_storage.cpp:1092.
    expect(inverseCentreRange).toBeCloseTo(1 / (6 + Math.sqrt(5) / 2), 6);
    // An area light casts no shadow in the fog, so its rectangle can share the lookup's texels.
    expect(texel(rows, 0, FogLightTexel.CONE).slice(1, 3)).toEqual([FogLightKind.AREA, 0]);
    expectDirection(texel(rows, 0, FogLightTexel.AREA_WIDTH).slice(0, 3), [2, 0, 0]);
    expectDirection(texel(rows, 0, FogLightTexel.AREA_HEIGHT).slice(0, 3), [0, 0, -1]);
  });

  it('sizes the rectangle of a scaled area light without the scale, as Godot does (edge case)', () => {
    const area = new THREE.RectAreaLight(0xffffff, Math.PI, 2, 1);
    area.scale.set(3, 3, 3);
    area.userData = areaLightUserData({ range: 6, attenuation: 1, specular: 1 });

    const rows = packed(placed(area));

    expect(rows.count).toBe(1);
    expectDirection(texel(rows, 0, FogLightTexel.AREA_WIDTH).slice(0, 3), [2, 0, 0]);
    expectDirection(texel(rows, 0, FogLightTexel.AREA_HEIGHT).slice(0, 3), [0, 1, 0]);
  });

  it('keeps a negative light negative, so the fog darkens', () => {
    const light = omni();
    light.intensity = -Math.PI;

    expect(texel(packed(placed(light)), 0, 1)[0]).toBeCloseTo(-Math.PI, 5);
  });

  it('answers that the rows changed only when a light moved', () => {
    const lights = placed(omni());
    const view = camera();
    const rows = new FogLightRows();

    expect(rows.pack(lights, view)).toBe(true);
    expect(rows.pack(lights, view)).toBe(false);
    lights[0]!.position.y = 9;
    lights[0]!.updateMatrixWorld();
    expect(rows.pack(lights, view)).toBe(true);
  });

  it('answers that the rows changed when a light leaves', () => {
    const lights = placed(omni(), omni());
    const view = camera();
    const rows = new FogLightRows();
    rows.pack(lights, view);

    expect(rows.pack(lights.slice(0, 1), view)).toBe(true);
    expect(rows.count).toBe(1);
  });
});

/** The matrix in the four texels from `first`, as the shader's `mat4` of four columns reads it. */
function packedMatrix(rows: FogLightRows, row: number, first: number): THREE.Matrix4 {
  const columns = [0, 1, 2, 3].flatMap((column) => texel(rows, row, first + column));
  return new THREE.Matrix4().fromArray(columns);
}

/** Where `world` lands through the packed matrix, after the divide by w. */
function landing(rows: FogLightRows, world: THREE.Vector3): number[] {
  const view = world.clone().applyMatrix4(camera().matrixWorldInverse);
  const shadow = new THREE.Vector4(view.x, view.y, view.z, 1).applyMatrix4(
    packedMatrix(rows, 0, FogLightTexel.SHADOW_MATRICES)
  );
  return [shadow.x / shadow.w, shadow.y / shadow.w, shadow.z / shadow.w];
}

describe('FogLightRows.pack, for a light that casts', () => {
  it("maps a view-space cell into a directional light's split of the atlas", () => {
    const rows = packed([castingSun()]);

    landing(rows, new THREE.Vector3(0, 0, 0)).forEach((component) => expect(component).toBeCloseTo(0.5, 6));
  });

  it("gives a directional light its shadow opacity, each slot's split end and depth range, and its fade", () => {
    const rows = packed([castingSun()]);

    expect(texel(rows, 0, FogLightTexel.CONE)[2]).toBeCloseTo(0.8, 6);
    expect(texel(rows, 0, FogLightTexel.SHADOW_SPLITS)).toEqual([12, 12, 12, 12]);
    expect(texel(rows, 0, FogLightTexel.SHADOW_RANGES)).toEqual([20, 20, 20, 20]);
    expect(texel(rows, 0, FogLightTexel.SHADOW_FADE)).toEqual([Math.fround(9.6), 12, 0, 0]);
  });

  it('leaves the shadow opacity of a light that casts nothing at zero (edge case)', () => {
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.shadow.intensity = 0.8;

    expect(texel(packed(placed(sun)), 0, FogLightTexel.CONE)[2]).toBe(0);
  });

  it("maps a cell on a spot light's axis to the centre of its slot, with its depth bias", () => {
    const spot = new THREE.SpotLight(0xffffff, 1, 10, Math.PI / 4);
    spot.position.set(0, 3, 0);
    spot.castShadow = true;
    const shadow = new AtlasSpotShadow();
    shadow.place({ x: 0, y: 0, size: 4096, paraboloidStep: null });
    shadow.bias = 0.002;
    spot.shadow = shadow;
    placed(spot);
    shadow.updateMatrices(spot);

    const rows = packed([spot]);

    landing(rows, new THREE.Vector3(0, 3, -5))
      .slice(0, 2)
      .forEach((component) => expect(component).toBeCloseTo(0.5, 6));
    expect(texel(rows, 0, FogLightTexel.CONE).slice(2)).toEqual([1, Math.fround(0.002)]);
  });

  it("puts a cell in an omni light's own space, beside its paraboloids' slot", () => {
    const light = omni();
    light.castShadow = true;
    const shadow = new AtlasOmniShadow();
    shadow.slot = { x: 512, y: 0, size: 512, paraboloidStep: [1, 0] };
    light.shadow = shadow;
    placed(light);

    const rows = packed([light]);

    expectDirection(landing(rows, new THREE.Vector3(0, 8, -2)), [0, 0, -2]);
    expect(texel(rows, 0, FogLightTexel.SHADOW_SPLITS)).toEqual([0.125, 0, 0.125, 0]);
  });

  it('leaves an omni light without a slot unshadowed (error case)', () => {
    const light = omni();
    light.castShadow = true;
    light.shadow = new AtlasOmniShadow();

    expect(texel(packed(placed(light)), 0, FogLightTexel.CONE)[2]).toBe(0);
  });
});

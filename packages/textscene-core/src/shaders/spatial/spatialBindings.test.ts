import * as THREE from 'three';
import type { NodeFrame, UniformNode } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { EnvironmentFog } from '../pipeline/environmentFog.js';
import { beforeEachDraw, specialiseSpatial, writeSpatialBindings } from './spatialBindings.js';
import { transpileSpatial } from './transpileSpatial.js';
import {
  hasDirectionalSoftShadowAngle,
  type DirectionalLight,
  type DirectionalShadow,
  type DirectionalShadowAtlasTextures,
} from './directionalLights.js';
import type { RoughnessLimiter } from '../../godot/rendering/roughnessLimiter.js';
import { comparedTextureOf, UNBOUND_DEPTH } from '../language/comparedTextures.js';

const UNSHADED = 'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n';

interface WrittenScene {
  fog?: EnvironmentFog;
  directionalShadowAtlas?: DirectionalShadowAtlasTextures;
  directionalLights?: readonly DirectionalLight[];
  source?: string;
  roughnessLimiter?: RoughnessLimiter;
}

function written({
  fog,
  directionalLights = [],
  source = UNSHADED,
  roughnessLimiter,
  directionalShadowAtlas,
}: WrittenScene = {}) {
  const spatial = transpileSpatial(source);
  const camera = new THREE.PerspectiveCamera(75, 2, 0.05, 4000);
  camera.position.set(0, 1, 3);
  const ambientLight = new THREE.Color(0.1, 0.2, 0.3);
  writeSpatialBindings(spatial, {
    camera,
    width: 128,
    height: 64,
    time: 2.5,
    ambientLight,
    emissiveExposure: 0.25,
    fog,
    directionalLights,
    roughnessLimiter,
    directionalShadowAtlas,
  });
  specialiseSpatial(spatial, {
    fog,
    drawsDirectionalSoftShadows: hasDirectionalSoftShadowAngle(directionalLights),
  });
  const value = (name: string) =>
    (spatial.uniforms.get(`scene_data_block.data.${name}`) as UniformNode<unknown>).value;
  const specialisation = (name: string) => spatial.specialisations.get(name)!.value;
  const light = (member: string) =>
    (spatial.uniforms.get(`directional_lights.data.${member}`) as { array: unknown[] }).array;
  return { spatial, camera, value, specialisation, light };
}

/** A depth fog with no depth end, so it ends at the far plane. */
const DEPTH_FOG: EnvironmentFog = {
  lightColor: new THREE.Color(0.5, 0.25, 1),
  lightEnergy: 2,
  mode: 1,
  density: 0.4,
  height: -1,
  heightDensity: 0.5,
  depthCurve: 1.5,
  depthBegin: 10,
  depthEnd: 0,
  sunScatter: 0,
  skyAffect: 1,
  aerialPerspective: 0.5,
};

describe('writeSpatialBindings', () => {
  it("writes Godot's projection: y flipped, and depth from 1 at the near plane to 0 at the far one", () => {
    const { camera, value } = written();
    const projection = value('projection_matrix') as THREE.Matrix4;
    const near = new THREE.Vector4(0, 0, -camera.near, 1).applyMatrix4(projection);
    const far = new THREE.Vector4(0, 0, -camera.far, 1).applyMatrix4(projection);
    expect(near.z / near.w).toBeCloseTo(1, 6);
    expect(far.z / far.w).toBeCloseTo(0, 6);
    expect(projection.elements[5]).toBeCloseTo(-camera.projectionMatrix.elements[5]!, 12);
  });

  it("writes the camera's transform as rows, with the origin in the last lane", () => {
    const columns = (written().value('inv_view_matrix') as THREE.Matrix4).elements;
    expect([columns[3], columns[7], columns[11]]).toEqual([0, 1, 3]);
    expect(columns.slice(12)).toEqual([0, 0, 0, 0]);
  });

  it('writes the size, the time, and the ambient light', () => {
    const { value } = written();
    expect((value('viewport_size') as THREE.Vector2).toArray()).toEqual([128, 64]);
    expect((value('screen_pixel_size') as THREE.Vector2).toArray()).toEqual([1 / 128, 1 / 64]);
    expect(value('time')).toBe(2.5);
    expect((value('ambient_light_color_energy') as THREE.Vector4).toArray()).toEqual([0.1, 0.2, 0.3, 1]);
  });

  it("writes the camera attributes' exposure as the emission's", () => {
    expect(written().value('emissive_exposure_normalization')).toBe(0.25);
  });
});

describe('the fog bindings', () => {
  it('leaves the fog flag and the depth fog off with no fog', () => {
    const { value, specialisation } = written();
    expect((value('flags') as number) & (1 << 4)).toBe(0);
    expect((specialisation('pso_sc_packed_0') as number) & (1 << 6)).toBe(0);
  });

  it('turns on the fog flag and the depth fog bit for a depth fog', () => {
    const { value, specialisation } = written({ fog: DEPTH_FOG });
    expect((value('flags') as number) & (1 << 4)).toBe(1 << 4);
    expect((specialisation('pso_sc_packed_0') as number) & (1 << 6)).toBe(1 << 6);
  });

  it('emits the stages again for the program of a depth fog', () => {
    const spatial = transpileSpatial(UNSHADED);
    const before = spatial.material.fragmentNode;
    specialiseSpatial(spatial, { fog: DEPTH_FOG, drawsDirectionalSoftShadows: false });
    expect(spatial.material.fragmentNode).not.toBe(before);
  });

  it('ends a depth fog with no end at the far plane', () => {
    const { value } = written({ fog: DEPTH_FOG });
    expect([value('fog_depth_begin'), value('fog_depth_end')]).toEqual([10, 4000]);
  });

  it('writes the light colour times its energy', () => {
    expect((written({ fog: DEPTH_FOG }).value('fog_light_color') as THREE.Vector3).toArray()).toEqual([
      1, 0.5, 2,
    ]);
  });

  it("writes the fog's aerial perspective", () => {
    expect(written({ fog: DEPTH_FOG }).value('fog_aerial_perspective')).toBe(0.5);
  });
});

const LIT = 'shader_type spatial;\nvoid fragment() {\n\tALBEDO = vec3(0.6);\n}\n';

/** A sun shining down and towards -Z: its +Z axis points up and back. */
const SUN: DirectionalLight = {
  direction: new THREE.Vector3(0, 1, 1).normalize(),
  energy: -2,
  color: new THREE.Color(0.5, 0.25, 1),
  specular: 0.7,
  size: 0.01,
  cullMask: 0xfffffffe,
  bakeMode: 1,
  volumetricFogEnergy: 3,
};

describe('the directional light bindings', () => {
  it('counts the lights that light surfaces', () => {
    expect(written({ directionalLights: [SUN, SUN], source: LIT }).value('directional_light_count')).toBe(2);
  });

  it("turns the light's direction into view space", () => {
    const [direction] = written({ directionalLights: [SUN], source: LIT }).light(
      'direction'
    ) as THREE.Vector3[];
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1, 3);
    camera.updateMatrixWorld();
    const expected = SUN.direction.clone().transformDirection(camera.matrixWorldInverse);
    expect(direction!.toArray()).toEqual(expected.toArray());
  });

  it('writes the energy times PI, the sign kept, as Godot does without physical light units', () => {
    expect(written({ directionalLights: [SUN], source: LIT }).light('energy')[0]).toBeCloseTo(
      -2 * Math.PI,
      12
    );
  });

  it("writes the light's own values unchanged", () => {
    const { light } = written({ directionalLights: [SUN], source: LIT });
    const own = ['specular', 'size', 'mask', 'bake_mode', 'volumetric_fog_energy'].map((m) => light(m)[0]);
    expect(own).toEqual([0.7, 0.01, 0xfffffffe, 1, 3]);
  });

  it('casts no shadow from a light without one', () => {
    expect(written({ directionalLights: [SUN], source: LIT }).light('shadow_opacity')[0]).toBe(0);
  });

  it('zeroes each slot past the last light, so a light that leaves lights nothing', () => {
    expect(
      written({ directionalLights: [SUN], source: LIT })
        .light('energy')
        .slice(1)
    ).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('turns on the roughness limiter in the opaque pass only', () => {
    const limiter = (source: string) => (written({ source }).value('flags') as number) & (1 << 3);
    expect(limiter(LIT)).toBe(1 << 3);
    expect(limiter(LIT.replace('vec3(0.6);', 'vec3(0.6);\n\tALPHA = 0.5;'))).toBe(0);
  });

  it('leaves the roughness limiter off when the project turns it off', () => {
    const roughnessLimiter = { isEnabled: false, amount: 0.25, limit: 0.18 };
    expect((written({ source: LIT, roughnessLimiter }).value('flags') as number) & (1 << 3)).toBe(0);
  });

  it("writes the project's roughness limiter amount and limit", () => {
    const { value } = written({
      source: LIT,
      roughnessLimiter: { isEnabled: true, amount: 1.5, limit: 0.5 },
    });
    expect([value('roughness_limiter_amount'), value('roughness_limiter_limit')]).toEqual([1.5, 0.5]);
  });
});

describe('beforeEachDraw', () => {
  /** A spatial shader whose scene the object update of three's node handler writes before each draw. */
  function eachDraw() {
    const spatial = transpileSpatial(UNSHADED);
    const drawnObjects: THREE.Object3D[] = [];
    const drawnMaterials: THREE.Material[] = [];
    beforeEachDraw(spatial, ({ camera, object, material }) => {
      drawnObjects.push(object);
      drawnMaterials.push(material);
      writeSpatialBindings(spatial, {
        camera: camera as THREE.PerspectiveCamera,
        width: 32,
        height: 16,
        time: 1,
        ambientLight: new THREE.Color(),
        emissiveExposure: 1,
        directionalLights: [],
      });
    });
    const uniform = (name: string) => spatial.uniforms.get(`scene_data_block.data.${name}`)!;
    return {
      draw: (
        camera: THREE.Camera,
        object: THREE.Object3D = new THREE.Mesh(),
        material: THREE.Material = spatial.material
      ) =>
        (uniform('projection_matrix') as UniformNode<unknown>).update({
          camera,
          object,
          material,
        } as unknown as NodeFrame),
      value: (name: string) => (uniform(name) as UniformNode<unknown>).value,
      drawnObjects,
      drawnMaterials,
    };
  }

  it('writes the scene of the camera a draw renders through', () => {
    const { draw, value } = eachDraw();
    draw(new THREE.PerspectiveCamera(60, 2, 0.5, 90));
    expect([value('z_near'), value('z_far')]).toEqual([0.5, 90]);
    expect((value('viewport_size') as THREE.Vector2).toArray()).toEqual([32, 16]);
  });

  it("writes the next draw's camera over the last one's", () => {
    const { draw, value } = eachDraw();
    draw(new THREE.PerspectiveCamera(60, 2, 0.5, 90));
    draw(new THREE.PerspectiveCamera(60, 2, 2, 40));
    expect([value('z_near'), value('z_far')]).toEqual([2, 40]);
  });

  it('hands on the object the draw renders', () => {
    const { draw, drawnObjects } = eachDraw();
    const mesh = new THREE.Mesh();
    draw(new THREE.PerspectiveCamera(), mesh);
    expect(drawnObjects).toEqual([mesh]);
  });

  it('hands on the material the draw renders with, so a depth draw is told apart', () => {
    const { draw, drawnMaterials } = eachDraw();
    const depth = new THREE.MeshDepthMaterial();
    draw(new THREE.PerspectiveCamera(), new THREE.Mesh(), depth);
    expect(drawnMaterials).toEqual([depth]);
  });
});

describe('the instance buffer of a transpiled spatial shader', () => {
  /** The object update three's node handler runs on each fetch of the buffer before a draw. */
  const drawn = (object: THREE.Object3D) => {
    const { spatial } = written();
    object.updateMatrixWorld();
    const rows = spatial.buffers.get('instances')!;
    const fetch = (rows as unknown as { store: { node: { update: (frame: NodeFrame) => void } } }).store.node;
    fetch.update({ renderId: 1, object } as NodeFrame);
    return spatial;
  };

  it('writes the transform of the object it is about to draw into the instance buffer', () => {
    const object = new THREE.Mesh();
    object.position.set(4, 5, 6);
    const image = drawn(object).buffers.get('instances')!.texture.image as { data: Uint32Array };
    expect([...new Float32Array(image.data.buffer).slice(0, 12)]).toEqual([
      1, 0, 0, 4, 0, 1, 0, 5, 0, 0, 1, 6,
    ]);
  });

  it('refuses an InstancedMesh by name, as no MultiMesh row is ported', () => {
    const instanced = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, 2);
    instanced.name = 'crowd';
    expect(() => drawn(instanced)).toThrow('InstancedMesh crowd');
  });

  it.each([
    ['Points', new THREE.Points()],
    ['LineSegments', new THREE.LineSegments()],
  ])("writes the instance of a %s, as Godot's point and line surfaces draw", (_type, object) => {
    object.position.set(4, 5, 6);
    const image = drawn(object).buffers.get('instances')!.texture.image as { data: Uint32Array };
    expect([...new Float32Array(image.data.buffer).slice(0, 4)]).toEqual([1, 0, 0, 4]);
  });
});

/** Split `split`'s world-to-atlas matrix: a scale and an offset that tell the splits apart. */
const splitMatrix = (split: number) =>
  new THREE.Matrix4().makeScale(0.5, 0.25, 0.125).setPosition(split * 0.25, 0.5, 0.5);

const SHADOW: DirectionalShadow = {
  opacity: 0.75,
  softShadowScale: 3,
  softShadowAngle: 0.2,
  blendSplits: true,
  fade: { from: 80, to: 100 },
  splitEnds: [10, 25, 60, 100],
  depthBiases: [0.1, 0.2, 0.3, 0.4],
  normalBiases: [0.01, 0.02, 0.03, 0.04],
  transmittanceBiases: [0.5, 0.6, 0.7, 0.8],
  rangeBegins: [12, 14, 16, 18],
  zRanges: [30, 40, 50, 60],
  splitMatrix,
};

const SHADOWED_SUN: DirectionalLight = { ...SUN, shadow: SHADOW };

describe('the directional shadow bindings', () => {
  const shadowed = () => written({ directionalLights: [SUN, SHADOWED_SUN], source: LIT });

  it("writes the shadow's opacity, kernel scale and angle in its light's slot", () => {
    const { light } = shadowed();
    const values = ['shadow_opacity', 'soft_shadow_scale', 'softshadow_angle'].map(
      (member) => light(member)[1]
    );
    expect(values).toEqual([0.75, 3, 0.2]);
  });

  it('writes whether the splits blend', () => {
    expect(shadowed().light('blend_splits').slice(0, 2)).toEqual([false, true]);
  });

  it('writes the fade as negative view depths, as Godot compares it with vertex.z', () => {
    const { light } = shadowed();
    expect([light('fade_from')[1], light('fade_to')[1]]).toEqual([-80, -100]);
  });

  it('writes each split end and bias as one lane of its vector', () => {
    const { light } = shadowed();
    const lanes = ['shadow_split_offsets', 'shadow_bias', 'shadow_normal_bias'].map((member) =>
      (light(member)[1] as THREE.Vector4).toArray()
    );
    expect(lanes).toEqual([SHADOW.splitEnds, SHADOW.depthBiases, SHADOW.normalBiases]);
  });

  it("maps a view-space point where each split's matrix maps it, with Godot's depth 1 - t", () => {
    const { light, camera } = shadowed();
    const world = new THREE.Vector3(1, 2, -3);
    const view = world.clone().applyMatrix4(camera.matrixWorldInverse);
    const reads = [1, 2, 3, 4].map((split) => {
      const matrix = light(`shadow_matrix${split}`)[1] as THREE.Matrix4;
      return view
        .clone()
        .applyMatrix4(matrix)
        .toArray()
        .map((lane) => +lane.toFixed(6));
    });
    const expected = [0, 1, 2, 3].map((split) => {
      const stored = world.clone().applyMatrix4(splitMatrix(split));
      stored.z = 1 - stored.z;
      return stored.toArray().map((lane) => +lane.toFixed(6));
    });
    expect(reads).toEqual(expected);
  });

  it('writes the transmittance bias, depth range and range start as one lane of each split', () => {
    const { light } = shadowed();
    const lanes = ['shadow_transmittance_bias', 'shadow_z_range', 'shadow_range_begin'].map((member) =>
      (light(member)[1] as THREE.Vector4).toArray()
    );
    expect(lanes).toEqual([SHADOW.transmittanceBiases, SHADOW.zRanges, SHADOW.rangeBegins]);
  });

  it("writes each split's atlas UV per world unit, the length of its matrix's first two rows", () => {
    const { light } = shadowed();
    const scales = [1, 2, 3, 4].map((split) => (light(`uv_scale${split}`)[1] as THREE.Vector2).toArray());
    expect(scales).toEqual([0, 1, 2, 3].map(() => [0.5, 0.25]));
  });

  it("writes the atlas's texel size", () => {
    const size = shadowed().value('directional_shadow_pixel_size') as THREE.Vector2;
    expect(size.toArray()).toEqual([1 / 4096, 1 / 4096]);
  });

  it("writes Soft Low's PCF taps of the directional kernel", () => {
    const { spatial } = shadowed();
    const kernel = (
      spatial.uniforms.get('scene_data_block.data.directional_soft_shadow_kernel') as {
        array: THREE.Vector4[];
      }
    ).array;
    expect(kernel[0]!.toArray().map((lane) => +lane.toFixed(6))).toEqual([0.353553, 0, 0, 0]);
  });

  it("writes Soft Low's eight taps of the directional penumbra kernel", () => {
    const { spatial } = shadowed();
    const kernel = (
      spatial.uniforms.get('scene_data_block.data.directional_penumbra_shadow_kernel') as {
        array: THREE.Vector4[];
      }
    ).array;
    expect(kernel[0]!.toArray().map((lane) => +lane.toFixed(6))).toEqual([0.25, 0, 0, 0]);
  });
});

describe('the directional soft shadow specialisation', () => {
  const softBit = (lights: readonly DirectionalLight[]) =>
    (written({ directionalLights: lights, source: LIT }).specialisation('pso_sc_packed_0') as number) &
    (1 << 3);

  it('turns on use_directional_soft_shadows when a shadow of the render has an angle', () => {
    expect(softBit([SUN, SHADOWED_SUN])).toBe(1 << 3);
  });

  it('leaves it off when every shadow has angle 0, as the light pass writes it with none on', () => {
    expect(softBit([{ ...SUN, shadow: { ...SHADOW, softShadowAngle: 0 } }])).toBe(0);
  });

  it('leaves it off for a light with no shadow (edge case)', () => {
    expect(softBit([SUN])).toBe(0);
  });
});

describe('the shadow quality specialisation', () => {
  /** The six bits of `pso_sc_packed_0` from bit `shift` (`scene_forward_clustered_inc.glsl:109-123`). */
  const samples = (shift: number) => ((written().specialisation('pso_sc_packed_0') as number) >>> shift) & 63;

  it("takes Soft Low's four PCF taps for omni, spot and directional shadows", () => {
    expect([samples(8), samples(20)]).toEqual([4, 4]);
  });

  it("takes Soft Low's eight penumbra taps for omni, spot and directional shadows", () => {
    expect([samples(14), samples(26)]).toEqual([8, 8]);
  });
});

describe('the directional shadow atlas', () => {
  it("gives the atlas to the template's compared reads of directional_shadow_atlas", () => {
    const atlas = { depth: new THREE.DepthTexture(4096, 4096), colour: new THREE.Texture() };
    const { spatial } = written({ source: LIT, directionalShadowAtlas: atlas });
    expect(comparedTextureOf(spatial.textures.get('directional_shadow_atlas')!).value).toBe(atlas.depth);
  });

  it('gives the compared reads a depth of one texel while no light has a shadow (edge case)', () => {
    const { spatial } = written({ source: LIT });
    expect(comparedTextureOf(spatial.textures.get('directional_shadow_atlas')!).value).toBe(UNBOUND_DEPTH);
  });
});

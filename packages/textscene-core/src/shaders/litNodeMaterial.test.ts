/** Godot's lit material, read on its generated GLSL with the light nodes registered. */

import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { DiffuseMode } from '../godot/rendering/materials/diffuseMode.js';
import { SpecularMode } from '../godot/rendering/materials/specularMode.js';
import {
  generatedMaterialProgram,
  generatedMaterialShader,
  unstartedRenderer,
} from './generatedShader.testkit.js';
import { installGodotShading, type GodotShading } from './godotShading.js';
import type { LitProgram } from './litNodeMaterial.js';
import { MAX_SUNS, SPLIT_SLOTS, SUN_ROWS, type SplitShadowLayout } from './sunRows.js';

const DEFAULT_PROGRAM: LitProgram = {
  diffuseMode: DiffuseMode.DIFFUSE_BURLEY,
  specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
  hasClearcoat: false,
};

/** The declaration of the pooled sun rows, which a program holds while a sun lights it. */
const SUN_ROWS_DECLARATION = `[${SUN_ROWS * MAX_SUNS}];`;

function shading(withAtlas = false): GodotShading {
  const shaded = installGodotShading({ setNodesHandler: vi.fn() } as unknown as THREE.WebGLRenderer);
  if (withAtlas) {
    const depth = new THREE.DepthTexture(4, 4);
    depth.compareFunction = THREE.LessEqualCompare;
    shaded.inputs.sunShadow = { depth, colour: new THREE.Texture(), rowsFromBottom: true };
  }
  return shaded;
}

/** A sun that casts with a split layout, as the renderer's split sun does. */
function shadowedSun(): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  const layout: SplitShadowLayout = {
    _cascadeData: Array.from({ length: SPLIT_SLOTS }, () => new THREE.Vector4()),
    rangeBegins: new THREE.Vector4(),
    fade: { from: 0, to: 0 },
    softShadowAngle: 0,
    getMatrix: () => new THREE.Matrix4(),
    mapSize: new THREE.Vector2(512, 512),
    getFrameExtents: () => new THREE.Vector2(1, 1),
    intensity: 1,
    radius: 1,
  };
  Object.assign(sun.shadow, layout);
  return sun;
}

function litShader(program: LitProgram, lights: THREE.Light[], withAtlas = false): string {
  return generatedMaterialShader(shading(withAtlas).surfaceMaterial(program), lights);
}

describe('GodotLitNodeMaterial', () => {
  beforeAll(() => {
    // The light nodes register on the install, which every case below needs.
    shading();
  });

  it('runs Godot’s light in a scene without lights, through the DFG table', () => {
    const shader = litShader(DEFAULT_PROGRAM, []);

    expect(shader).toContain('vec2( clamp( dot( normalView, positionViewDirection ), 0.0001, 1.0 )');
    expect(shader).not.toContain(SUN_ROWS_DECLARATION);
  });

  it('reads a directional light from the pooled sun rows', () => {
    expect(litShader(DEFAULT_PROGRAM, [new THREE.DirectionalLight()])).toContain(SUN_ROWS_DECLARATION);
  });

  it('reads the shadow of a sun that casts one with a split layout', () => {
    expect(litShader(DEFAULT_PROGRAM, [shadowedSun()], true)).toContain('godotSunShadow(');
  });

  it('declares the vertex vars that feed the shadow’s normal bias', () => {
    const material = shading(true).surfaceMaterial(DEFAULT_PROGRAM);
    const { vertexShader } = generatedMaterialProgram(material, [shadowedSun()]);

    expect(vertexShader).toContain('vec3 normalLocal;');
    expect(vertexShader).toContain('mat4 modelViewMatrix;');
  });

  it('declares the atlas in each program of one renderer, with its shadow functions', () => {
    const shaded = shading(true);
    const renderer = unstartedRenderer();
    const sun = [shadowedSun()];
    generatedMaterialProgram(
      shaded.surfaceMaterial({ ...DEFAULT_PROGRAM, hasClearcoat: true }),
      [],
      renderer
    );
    const { fragmentShader } = generatedMaterialProgram(
      shaded.surfaceMaterial(DEFAULT_PROGRAM),
      sun,
      renderer
    );
    generatedMaterialProgram(
      shaded.surfaceMaterial({ ...DEFAULT_PROGRAM, hasClearcoat: true }),
      sun,
      renderer
    );
    const second = generatedMaterialProgram(
      shaded.surfaceMaterial(DEFAULT_PROGRAM),
      sun,
      renderer
    ).fragmentShader;

    for (const shader of [fragmentShader, second]) {
      const atlas = /texture\( (\w+), vec3\(/.exec(shader)?.[1];
      expect(shader).toContain(`uniform sampler2DShadow ${atlas};`);
    }
  });

  it('compiles the blocker search only while the material searches directional blockers', () => {
    const material = shading(true).surfaceMaterial(DEFAULT_PROGRAM);
    const plain = generatedMaterialShader(material, [shadowedSun()]);
    material.searchesDirectionalBlockers = true;
    const searching = generatedMaterialShader(material, [shadowedSun()]);

    expect(plain).not.toContain('godotSunSoftShadow');
    expect(searching).toContain('godotSunSoftShadow');
  });

  it('gives the blocker search a program of its own', () => {
    const material = shading().surfaceMaterial(DEFAULT_PROGRAM);
    const plainKey = material.customProgramCacheKey();
    material.searchesDirectionalBlockers = true;

    expect(material.customProgramCacheKey()).not.toBe(plainKey);
  });

  it('builds under an area light, which has no port yet and adds nothing', () => {
    const lit = litShader(DEFAULT_PROGRAM, [new THREE.RectAreaLight()]);

    expect(lit).not.toContain('ltc_1');
  });

  it('reads no shadow while the inputs hold no atlas', () => {
    expect(litShader(DEFAULT_PROGRAM, [shadowedSun()])).not.toContain('godotSunShadow(');
  });

  it('reads no shadow of a sun that casts none', () => {
    expect(litShader(DEFAULT_PROGRAM, [new THREE.DirectionalLight()], true)).not.toContain('godotSunShadow(');
  });

  it('adds the clearcoat’s lobe only to a program with a clearcoat', () => {
    const coatLobe = /mix\( 0\.001, 0\.1, /;
    const sun = [new THREE.DirectionalLight()];

    expect(litShader({ ...DEFAULT_PROGRAM, hasClearcoat: true }, sun)).toMatch(coatLobe);
    expect(litShader(DEFAULT_PROGRAM, sun)).not.toMatch(coatLobe);
  });

  it('reads its colour from itself, so each surface of a mesh with several draws its own', () => {
    const material = shading().surfaceMaterial(DEFAULT_PROGRAM);
    const colour = (material as unknown as { colorNode: { material: unknown } }).colorNode;

    expect(colour.material).toBe(material);
  });

  it('gives each light mode a program of its own', () => {
    const material = shading().surfaceMaterial(DEFAULT_PROGRAM);
    const toon = shading().surfaceMaterial({ ...DEFAULT_PROGRAM, diffuseMode: DiffuseMode.DIFFUSE_TOON });

    expect(material.customProgramCacheKey()).not.toBe(toon.customProgramCacheKey());
  });

  it('leaves a material of three’s own to three’s directional light', () => {
    const shader = generatedMaterialShader(new MeshStandardNodeMaterial(), [new THREE.DirectionalLight()]);

    expect(shader).not.toContain(SUN_ROWS_DECLARATION);
  });
});

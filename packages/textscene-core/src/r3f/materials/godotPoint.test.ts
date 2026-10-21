import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointDrawOf, withPointDraw, type PointDraw } from './godotPoint';
import type { ProgramShader } from '../materialProgramInputs';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterialBag } from '../../resources/materials/standardmaterial3d/materialBag';

const BAG: StandardMaterialBag = { materialClass: 'standard', props: { color: 'red' } };
const SIZE_6: PointDraw = { pixels: 6, samplesAlbedoAtPointCoord: false };
const SIZE_6_AT_COORD: PointDraw = { pixels: 6, samplesAlbedoAtPointCoord: true };
const BOUND_MAP: StandardMaterialBag = { ...BAG, props: { map: new THREE.Texture() } };

/** What `bag` as a points material leaves of the shaders, and the material it compiles on. */
function compiled(
  bag: StandardMaterialBag,
  draw: PointDraw,
  { vertexShader = '', fragmentShader = '' } = {}
) {
  const sized = withPointDraw(bag, draw);
  const material = new THREE.MeshStandardMaterial({ userData: sized.props.userData });
  const shader: ProgramShader = { vertexShader, fragmentShader, uniforms: {} };
  sized.injection!.onBeforeCompile.call(material, shader);
  return { shader, material, sized };
}

describe.each([
  ['MeshBasicMaterial', THREE.ShaderLib.basic.vertexShader],
  ['MeshStandardMaterial', THREE.ShaderLib.standard.vertexShader],
  ['MeshPhysicalMaterial', THREE.ShaderLib.physical.vertexShader],
])('the point size on the %s vertex shader', (_type, vertexShader) => {
  const patched = compiled(BAG, SIZE_6, { vertexShader }).shader.vertexShader;

  // `scene_forward_clustered.glsl:724` writes `gl_PointSize = point_size`.
  it('writes gl_PointSize from the point size uniform', () => {
    expect(patched).toContain('gl_PointSize = godotPointSize;');
    expect(patched).toContain('uniform float godotPointSize;');
  });

  it('writes it after the projection, as Godot writes it after the vertex stage', () => {
    expect(patched.indexOf('gl_PointSize')).toBeGreaterThan(patched.indexOf('#include <project_vertex>'));
  });
});

describe('the point size uniform', () => {
  it('reads the size of the draw', () => {
    expect(compiled(BAG, { ...SIZE_6, pixels: 20 }).shader.uniforms.godotPointSize!.value).toBe(20);
  });

  it('follows a later change to the userData, so a new size needs no recompile', () => {
    const { shader, material } = compiled(BAG, SIZE_6);
    material.userData = withPointDraw(BAG, { ...SIZE_6, pixels: 8 }).props.userData!;
    expect(shader.uniforms.godotPointSize!.value).toBe(8);
  });

  it("is the shader's 1 px on a material that records none (edge case)", () => {
    // `scene_forward_clustered.glsl:446`.
    const { shader, material } = compiled(BAG, SIZE_6);
    material.userData = {};
    expect(shader.uniforms.godotPointSize!.value).toBe(1);
  });
});

describe('pointDrawOf', () => {
  it('is the 1 px default of a material with no point size', () => {
    expect(pointDrawOf(null, 1)).toEqual({ pixels: 1, samplesAlbedoAtPointCoord: false });
  });

  it('is point_size under use_point_size, and samples the albedo at the point coordinate', () => {
    const scalars = parseStandardMaterial3DScalars({ use_point_size: 'true', point_size: '12' });
    expect(pointDrawOf(scalars, 1)).toEqual({ pixels: 12, samplesAlbedoAtPointCoord: true });
  });

  // `material.cpp:1229-1232` writes POINT_SIZE, and `:1612-1615` samples at POINT_COORD, only under the flag.
  it('ignores point_size without use_point_size (edge case)', () => {
    const scalars = parseStandardMaterial3DScalars({ point_size: '12' });
    expect(pointDrawOf(scalars, 1)).toEqual({ pixels: 1, samplesAlbedoAtPointCoord: false });
  });

  // Godot's pixels are its viewport's, and a canvas of pixel ratio 2 has twice as many per side.
  it.each([
    ['point_size', { use_point_size: 'true', point_size: '12' }, 24],
    ['the 1 px default', {}, 2],
  ])('scales %s by the canvas pixel ratio', (_what, properties, pixels) => {
    expect(pointDrawOf(parseStandardMaterial3DScalars(properties), 2).pixels).toBe(pixels);
  });
});

describe('the albedo map on the fragment shader', () => {
  it.each([
    ['MeshBasicMaterial', THREE.ShaderLib.basic.fragmentShader],
    ['MeshStandardMaterial', THREE.ShaderLib.standard.fragmentShader],
  ])('reads the %s map at the point coordinate, not the UV', (_type, fragmentShader) => {
    // `material.cpp:1612-1615`: `texture(texture_albedo, POINT_COORD)`. Point coordinates run down
    // from the top, as an image does, and three's V runs up.
    expect(compiled(BOUND_MAP, SIZE_6_AT_COORD, { fragmentShader }).shader.fragmentShader).toContain(
      '#define vMapUv vec2( gl_PointCoord.x, 1.0 - gl_PointCoord.y )'
    );
  });

  it('defines it after the varying is declared, so the declaration stays', () => {
    const { fragmentShader } = compiled(BOUND_MAP, SIZE_6_AT_COORD, {
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    }).shader;
    expect(fragmentShader.indexOf('#define vMapUv')).toBeGreaterThan(
      fragmentShader.indexOf('#include <uv_pars_fragment>')
    );
  });

  it('leaves the UV alone without use_point_size (edge case)', () => {
    const { fragmentShader } = compiled(BOUND_MAP, SIZE_6, {
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    }).shader;
    expect(fragmentShader).not.toContain('#define vMapUv');
  });

  it('leaves the UV alone when the material binds no map (edge case)', () => {
    const { fragmentShader } = compiled(BAG, SIZE_6_AT_COORD, {
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
    }).shader;
    expect(fragmentShader).not.toContain('#define vMapUv');
  });
});

describe('withPointDraw', () => {
  it('hands the same bag back for the same draw, so a render that changes nothing changes no prop', () => {
    expect(withPointDraw(BAG, { ...SIZE_6 })).toBe(withPointDraw(BAG, { ...SIZE_6 }));
  });

  it('forms a new bag for another size', () => {
    expect(withPointDraw(BAG, SIZE_6)).not.toBe(withPointDraw(BAG, { ...SIZE_6, pixels: 7 }));
  });

  it('keeps the bag otherwise', () => {
    const sized = withPointDraw(BAG, SIZE_6);
    expect(sized.materialClass).toBe('standard');
    expect(sized.props.color).toBe('red');
  });

  // Godot's cull mode culls polygons only, and a point is never a back face. three flips the
  // normal of a BackSide material, so a point under `cull_mode = CULL_FRONT` would light from behind.
  it.each([THREE.BackSide, THREE.DoubleSide])('draws a point front-facing under side %i', (side) => {
    expect(withPointDraw({ ...BAG, props: { side } }, SIZE_6).props.side).toBe(THREE.FrontSide);
  });

  it("keeps the bag's own userData", () => {
    const sized = withPointDraw({ ...BAG, props: { userData: { own: 1 } } }, SIZE_6);
    expect(sized.props.userData).toMatchObject({ own: 1 });
  });
});

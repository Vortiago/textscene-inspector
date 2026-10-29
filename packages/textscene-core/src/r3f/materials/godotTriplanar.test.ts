/**
 * Godot's triplanar mapping in three's programs: the projected position and blend weights of each
 * UV set (`material.cpp:1418-1454`), the three-sample blend (`material.cpp:1496-1500`) and the
 * tangent frame Godot writes for a projecting surface (`material.cpp:1386-1414`).
 */
import { describe, expect, it } from 'vitest';
import {
  readsObjectSpace,
  triplanarInjection,
  triplanarUserData,
  type TriplanarRecord,
} from './godotTriplanar';
import { nodePoseUniforms } from './nodePose';
import { MATERIAL_OF_PROGRAM, programShader, type ProgramName } from '../testing/patchedFragment';
import { worldTriplanarRecord } from '../testing/triplanarRecord';
import type { ProgramShader } from '../materialProgramInputs';

/** `record` on a material of `program`, and that program as its compile leaves it. */
function compiled(record: TriplanarRecord, program: ProgramName = 'physical') {
  const material = MATERIAL_OF_PROGRAM[program]();
  material.userData = triplanarUserData(record);
  const shader: ProgramShader = programShader(program);
  triplanarInjection(material)!.onBeforeCompile.call(material, shader);
  return { material, shader };
}

const LOCAL_UV1 = { scale: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 }, sharpness: 1, isWorld: false };

describe('triplanarInjection: the projected position and weights', () => {
  it("projects the world position under world triplanar, as Godot's MODEL_MATRIX * VERTEX", () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;

    expect(vertexShader).toContain('#define GODOT_UV1_WORLD_TRIPLANAR\n');
    expect(vertexShader).toContain('vec3 godotUv1Position = ( godotModel * vec4( godotVertex, 1.0 ) ).xyz;');
  });

  it("projects the mesh's own position under local triplanar", () => {
    const { vertexShader } = compiled(worldTriplanarRecord({ uv1: LOCAL_UV1, isTangentWorld: false })).shader;

    expect(vertexShader).toContain('#define GODOT_UV1_TRIPLANAR\n');
    expect(vertexShader).not.toContain('#define GODOT_UV1_WORLD_TRIPLANAR');
  });

  it('scales, offsets and flips Y in that order, as Godot does', () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;
    const scaled = vertexShader.indexOf(
      'vGodotUv1TriplanarPos = godotUv1Position * godotUv1TriplanarScale + godotUv1TriplanarOffset;'
    );
    const flipped = vertexShader.indexOf('vGodotUv1TriplanarPos *= vec3( 1.0, - 1.0, 1.0 );');

    expect(scaled).toBeGreaterThan(0);
    expect(flipped).toBeGreaterThan(scaled);
  });

  it('weighs by the normal to the power of the sharpness, normalised to a sum of 1', () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;

    expect(vertexShader).toContain(
      'vGodotUv1PowerNormal = pow( abs( godotUv1Normal ), vec3( godotUv1TriplanarSharpness ) );'
    );
    expect(vertexShader).toContain('vGodotUv1PowerNormal /= dot( vGodotUv1PowerNormal, vec3( 1.0 ) );');
  });

  it("weighs UV1 by MODEL_NORMAL_MATRIX and UV2 by mat3(MODEL_MATRIX), as Godot's two sets differ", () => {
    const { vertexShader } = compiled(worldTriplanarRecord({ uv2: { ...LOCAL_UV1, isWorld: true } })).shader;

    expect(vertexShader).toContain('vec3 godotUv1Normal = godotModelNormal * godotNormal;');
    expect(vertexShader).toContain('vec3 godotUv2Normal = mat3( godotModel ) * godotNormal;');
  });

  it("reads the node's model through the instance, as Godot's MODEL_MATRIX holds a MultiMesh instance", () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;

    expect(vertexShader).toContain('mat4 godotModel = modelMatrix * godotModelFromObject;');
    expect(vertexShader).toContain('godotModel *= instanceMatrix;');
    expect(vertexShader).toContain('godotModelNormal *= mat3( instanceMatrix );');
  });

  it('turns the normal by the cofactors of the basis, MODEL_NORMAL_MATRIX up to a positive scale', () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;

    expect(vertexShader).toContain(
      'mat3 cofactors = mat3( cross( m[ 1 ], m[ 2 ] ), cross( m[ 2 ], m[ 0 ] ), cross( m[ 0 ], m[ 1 ] ) );'
    );
    expect(vertexShader).toContain('return cofactors * sign( dot( m[ 0 ], cofactors[ 0 ] ) );');
    expect(vertexShader).toContain('mat3 godotModelNormal = godotNormalMatrix( mat3( godotModel ) );');
  });

  it("reads a merged GridMap point's item position and normal, placed by its cell as an instance", () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;
    const cellPoints = vertexShader.slice(vertexShader.indexOf('#ifdef GODOT_PLACED_POINTS'));

    expect(cellPoints).toContain('godotNormal = godotItemNormal;');
    expect(cellPoints).toContain('godotVertex = godotItemPosition;');
    expect(cellPoints).toContain('godotModel *= godotPlaceMatrix;');
    expect(cellPoints).toContain('godotModelNormal *= mat3( godotPlaceMatrix );');
  });
});

describe('triplanarInjection: the samples', () => {
  it('blends XY by the Z weight, XZ by the Y weight and ZY by the X weight (material.cpp:1496-1500)', () => {
    const { fragmentShader } = compiled(worldTriplanarRecord()).shader;
    const at = (coordinate: string) =>
      `texture2D( map, godotTriplanarUv( mapTransform, vGodotUv1TriplanarPos${coordinate} ) )`;

    expect(fragmentShader).toContain(
      `( ${at('.xy')} * vGodotUv1PowerNormal.z + ${at('.xz')} * vGodotUv1PowerNormal.y + ${at(
        '.zy * vec2( - 1.0, 1.0 )'
      )} * vGodotUv1PowerNormal.x )`
    );
  });

  it('samples a UV2 map in the UV2 projection', () => {
    const { fragmentShader } = compiled(
      worldTriplanarRecord({ uv1: null, uv1Maps: [], uv2: LOCAL_UV1, uv2Maps: ['emissiveMap'] })
    ).shader;

    expect(fragmentShader).toContain('godotTriplanarUv( emissiveMapTransform, vGodotUv2TriplanarPos.xy )');
    expect(fragmentShader).not.toContain('( emissiveMap, vEmissiveMapUv )');
  });

  it('leaves a map outside the record at its UV (edge case)', () => {
    const { fragmentShader } = compiled(worldTriplanarRecord({ uv1Maps: ['roughnessMap'] })).shader;

    expect(fragmentShader).toContain('#include <map_fragment>');
    expect(fragmentShader).not.toContain('godotTriplanarUv( mapTransform');
  });

  it('reads the normal map in the three projections at gradients from main', () => {
    const { fragmentShader } = compiled(worldTriplanarRecord()).shader;

    expect(fragmentShader).toContain(
      '#undef GODOT_NORMAL_TEXEL\n#define GODOT_NORMAL_TEXEL( step ) godotTriplanarNormalTexel('
    );
    expect(fragmentShader).toContain('vec3 godotUv1PositionDx = dFdx( vGodotUv1TriplanarPos );');
    expect(fragmentShader).not.toContain('godotTriplanarUv( normalMapTransform, vGodotUv1TriplanarPos');
  });

  it("samples the albedo in a shadow's depth program too, so its alpha cut matches", () => {
    const { fragmentShader } = compiled(worldTriplanarRecord(), 'depth').shader;

    expect(fragmentShader).toContain('godotTriplanarUv( mapTransform, vGodotUv1TriplanarPos.xy )');
    expect(fragmentShader).not.toContain('tbn = mat3( vGodotTriplanarTangent');
  });
});

describe('triplanarInjection: the tangent frame', () => {
  it("replaces three's frame with Godot's after the face flip, keeping the normal", () => {
    const { fragmentShader } = compiled(worldTriplanarRecord()).shader;
    const begin = fragmentShader.indexOf('#include <normal_fragment_begin>');

    expect(
      fragmentShader.indexOf('tbn = mat3( vGodotTriplanarTangent, vGodotTriplanarBinormal, normal );')
    ).toBeGreaterThan(begin);
  });

  it('writes the frame in world space under uv1_world_triplanar, through inverse(MODEL_NORMAL_MATRIX)', () => {
    const { vertexShader } = compiled(worldTriplanarRecord()).shader;

    expect(vertexShader).toContain('#define GODOT_TRIPLANAR_TANGENT_WORLD\n');
    expect(vertexShader).toContain('mat3 godotNormalModel = inverse( godotModelNormal );');
    expect(vertexShader).toContain('godotTangent = godotNormalModel * normalize( godotTangent );');
  });

  it("turns a billboard's frame by mat3(MODELVIEW_MATRIX), as Godot's billboard writes it", () => {
    const { vertexShader } = compiled(worldTriplanarRecord({ isBillboard: true })).shader;

    expect(vertexShader).toContain('#define GODOT_TRIPLANAR_BILLBOARD\n');
  });

  it('turns the frame on whenever a UV set projects, as Godot writes TANGENT for either', () => {
    const { vertexShader } = compiled(
      worldTriplanarRecord({ uv1: null, uv1Maps: [], uv2: LOCAL_UV1 })
    ).shader;

    expect(vertexShader).toContain('#define GODOT_TRIPLANAR_FRAME\n');
  });
});

describe('triplanarInjection: uniforms and programs', () => {
  it('reads the scale, offset and sharpness from the record at each upload', () => {
    const { material, shader } = compiled(worldTriplanarRecord());
    material.userData = triplanarUserData(
      worldTriplanarRecord({
        uv1: { scale: { x: 3, y: 4, z: 5 }, offset: { x: 1, y: 0, z: 2 }, sharpness: 9, isWorld: true },
      })
    );

    expect(shader.uniforms['godotUv1TriplanarScale']!.value).toEqual({ x: 3, y: 4, z: 5 });
    expect(shader.uniforms['godotUv1TriplanarOffset']!.value).toEqual({ x: 1, y: 0, z: 2 });
    expect(shader.uniforms['godotUv1TriplanarSharpness']!.value).toBe(9);
  });

  it("shares the material's node pose with every other patch that reads it", () => {
    const { material, shader } = compiled(worldTriplanarRecord());

    expect(shader.uniforms['godotModelFromObject']).toBe(nodePoseUniforms(material).godotModelFromObject);
  });

  it('keeps one program for records that differ only in values', () => {
    const changed = worldTriplanarRecord({ uv1: { ...worldTriplanarRecord().uv1!, sharpness: 150 } });

    expect(triplanarInjection({ userData: triplanarUserData(changed) })).toBe(
      triplanarInjection({ userData: triplanarUserData(worldTriplanarRecord()) })
    );
  });

  it('compiles a new program for a record whose space or maps differ', () => {
    const key = (record: TriplanarRecord) =>
      triplanarInjection({ userData: triplanarUserData(record) })!.cacheKey;
    const world = key(worldTriplanarRecord());

    expect(key(worldTriplanarRecord({ uv1: LOCAL_UV1 }))).not.toBe(world);
    expect(key(worldTriplanarRecord({ uv1Maps: ['map'] }))).not.toBe(world);
  });

  it('compiles nothing for a material that records no mapping', () => {
    expect(triplanarInjection({ userData: {} })).toBeUndefined();
    expect(triplanarInjection({})).toBeUndefined();
  });
});

describe('readsObjectSpace', () => {
  it('holds for a local projection', () => {
    expect(readsObjectSpace(worldTriplanarRecord({ uv1: LOCAL_UV1 }))).toBe(true);
  });

  it('holds for a local frame under a world projection, as the frame reads the mesh normal', () => {
    expect(readsObjectSpace(worldTriplanarRecord({ isTangentWorld: false }))).toBe(true);
  });

  it('fails for a world projection in a world frame', () => {
    expect(readsObjectSpace(worldTriplanarRecord())).toBe(false);
  });

  it('fails for no mapping (edge case)', () => {
    expect(readsObjectSpace(null)).toBe(false);
  });
});

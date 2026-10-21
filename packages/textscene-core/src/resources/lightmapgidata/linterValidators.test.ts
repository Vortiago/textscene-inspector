/** LightmapGIData validators, on the `[sub_resource]` itself. */

import { describe, it } from 'vitest';
import { expectDiagnostic, expectNoDiagnostic } from '../../linter/testing/testkit';
import './linterValidators';

function sceneWithData(properties: string): string {
  return `[gd_scene format=3]

[ext_resource type="CompressedTexture2DArray" path="res://scene.exr" id="1_atlas"]

[sub_resource type="LightmapGIData" id="LightmapGIData_1"]
${properties}

[node name="Root" type="Node3D"]
`;
}

const PROBE_DATA =
  'probe_data = { "bounds": AABB(0, 0, 0, 1, 1, 1), "points": PackedVector3Array(), "tetrahedra": PackedInt32Array(), "bsp": PackedInt32Array(), "sh": PackedColorArray(), "interior": false, "baked_exposure": 1.0 }';

describe('LightmapGIData validators', () => {
  describe('lightmap_textures and shadowmask_textures', () => {
    it('accept the typed texture array Godot writes', () => {
      expectNoDiagnostic(
        sceneWithData('lightmap_textures = Array[TextureLayered]([ExtResource("1_atlas")])'),
        {
          prop: 'lightmap_textures',
        }
      );
    });

    it('error on an array typed otherwise, which the TypedArray setter refuses', () => {
      expectDiagnostic(sceneWithData('shadowmask_textures = Array[int]([1])'), {
        prop: 'shadowmask_textures',
        severity: 'error',
      });
    });

    it('error on a value that is no array (edge case)', () => {
      expectDiagnostic(sceneWithData('lightmap_textures = 3'), {
        prop: 'lightmap_textures',
        severity: 'error',
      });
    });
  });

  describe('user_data', () => {
    it('accepts whole groups of path, UV scale, slice and sub-instance', () => {
      expectNoDiagnostic(sceneWithData('user_data = [NodePath("Floor"), Rect2(0, 0, 1, 1), 0, -1]'), {
        prop: 'user_data',
      });
    });

    it('errors on a count that is no multiple of four, which the setter refuses', () => {
      expectDiagnostic(sceneWithData('user_data = [NodePath("Floor"), Rect2(0, 0, 1, 1), 0]'), {
        prop: 'user_data',
        severity: 'error',
      });
    });

    it('accepts an empty array (edge case)', () => {
      expectNoDiagnostic(sceneWithData('user_data = []'), { prop: 'user_data' });
    });
  });

  describe('probe_data', () => {
    it('accepts a dictionary with every field the setter requires', () => {
      expectNoDiagnostic(sceneWithData(PROBE_DATA), { prop: 'probe_data' });
    });

    it('errors on a dictionary without one of them, which the setter refuses', () => {
      expectDiagnostic(sceneWithData(PROBE_DATA.replace('"bsp": PackedInt32Array(), ', '')), {
        prop: 'probe_data',
        severity: 'error',
      });
    });

    it('errors on a value that is no dictionary (edge case)', () => {
      expectDiagnostic(sceneWithData('probe_data = []'), { prop: 'probe_data', severity: 'error' });
    });
  });

  describe('uses_spherical_harmonics and _uses_packed_directional', () => {
    it('accept a bool', () => {
      expectNoDiagnostic(sceneWithData('uses_spherical_harmonics = true'), {
        prop: 'uses_spherical_harmonics',
      });
    });

    it('error on a value that is no bool', () => {
      expectDiagnostic(sceneWithData('_uses_packed_directional = "yes"'), {
        prop: '_uses_packed_directional',
        severity: 'error',
      });
    });
  });
});

/**
 * One warning for each resource slot whose reference resolves to a class its
 * `PROPERTY_HINT_RESOURCE_TYPE` hint excludes with a `-` prefix: the generic pass
 * behind `resource-type-excluded-by-hint`.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { reportsOf } from './testing/tierLists.js';
import './index.js';

const RULE = FILE_DIAGNOSTICS.resourceTypeExcludedByHint.ruleName;

/** The rule's reports on `content`, each asserted at warning. */
function excluded(content: string) {
  return reportsOf(lint(content), RULE, 'warning');
}

describe('resource-type-excluded-by-hint', () => {
  it('warns on an inline SubResource of an excluded type, naming the type and the property', () => {
    const reports = excluded(
      scene(
        subResource('AtlasTexture', {}, 'atlas_1'),
        node('OmniLight3D', { light_projector: 'SubResource("atlas_1")' })
      )
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]!.message).toContain('AtlasTexture');
    expect(reports[0]!.message).toContain('Light3D.light_projector');
  });

  it('warns on an ExtResource whose declared type is excluded', () => {
    const atlas = '[ext_resource type="AtlasTexture" path="res://atlas.tres" id="1_atlas"]';
    const reports = excluded(
      scene(atlas, node('OmniLight3D', { light_projector: 'ExtResource("1_atlas")' }))
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]!.message).toContain('AtlasTexture');
  });

  it('says nothing about an ExtResource declared as the hint base', () => {
    const texture = '[ext_resource type="Texture2D" path="res://t.png" id="1_tex"]';
    expect(
      excluded(scene(texture, node('OmniLight3D', { light_projector: 'ExtResource("1_tex")' })))
    ).toEqual([]);
  });

  it('puts the warning on the line of the property', () => {
    const reports = excluded(
      scene(
        subResource('AtlasTexture', {}, 'atlas_1'),
        node('SpotLight3D', { light_energy: 2, light_projector: 'SubResource("atlas_1")' })
      )
    );
    expect(reports[0]!.location?.line).toBe(7);
  });

  it.each([
    ['DirectionalLight3D', 'light_projector', 'CanvasTexture'],
    ['AreaLight3D', 'light_projector', 'ViewportTexture'],
    ['AreaLight3D', 'area_texture', 'AtlasTexture'],
    ['PointLight2D', 'texture', 'AnimatedTexture'],
    ['Decal', 'texture_albedo', 'MeshTexture'],
    ['Decal', 'texture_normal', 'CameraTexture'],
    ['Decal', 'texture_orm', 'Texture2DRD'],
    ['Decal', 'texture_emission', 'AtlasTexture'],
    ['CSGMesh3D', 'mesh', 'PlaneMesh'],
    ['CSGMesh3D', 'mesh', 'QuadMesh'],
  ])('warns on %s.%s holding a %s', (nodeType, key, resourceType) => {
    const reports = excluded(
      scene(subResource(resourceType, {}, 'res_1'), node(nodeType, { [key]: 'SubResource("res_1")' }))
    );
    expect(reports).toHaveLength(1);
  });

  it.each([
    ['AreaLight3D', 'area_texture', 'GradientTexture2D'],
    ['Decal', 'texture_albedo', 'ImageTexture'],
    ['CSGMesh3D', 'mesh', 'BoxMesh'],
  ])('says nothing about %s.%s holding the allowed %s', (nodeType, key, resourceType) => {
    expect(
      excluded(
        scene(subResource(resourceType, {}, 'res_1'), node(nodeType, { [key]: 'SubResource("res_1")' }))
      )
    ).toEqual([]);
  });

  it.each(['null', '""', 'SubResource("missing")', '1.0'])(
    'says nothing about a slot holding %s',
    (value) => {
      expect(excluded(scene(node('OmniLight3D', { light_projector: value })))).toEqual([]);
    }
  );

  it('says nothing about a slot whose hint excludes no class', () => {
    expect(
      excluded(
        scene(
          subResource('AtlasTexture', {}, 'atlas_1'),
          node('Sprite2D', { texture: 'SubResource("atlas_1")' })
        )
      )
    ).toEqual([]);
  });
});

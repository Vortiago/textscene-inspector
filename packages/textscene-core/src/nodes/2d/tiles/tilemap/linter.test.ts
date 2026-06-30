/**
 * Semantic lint rules for the legacy TileMap: actionable diagnostics instead
 * of "unknown type" (PRD #74 story 16).
 */
import { describe, it, expect } from 'vitest';
import { lint, expectDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

function scene(nodeProps: string, resources = ''): string {
  return `[gd_scene format=3]
${resources}
[node name="World" type="Node2D"]

[node name="Map" type="TileMap" parent="."]
${nodeProps}
`;
}

const TILESET_RESOURCES = `
[sub_resource type="TileSet" id="TileSet_a"]
tile_size = Vector2i(16, 16)
`;

describe('TileMap lint rules', () => {
  it('warns when a layer has tile data but no tile_set is assigned', () => {
    expectDiagnostic(scene(`format = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`), {
      ruleName: 'tilemap-requires-tileset',
      severity: 'warning',
    });
  });

  it('errors when the tile_set resource reference cannot be resolved', () => {
    expectDiagnostic(
      scene(`tile_set = ExtResource("99")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`),
      { ruleName: 'valid-tilemap-resources', severity: 'error' }
    );
  });

  it('warns on Godot-3-era tile data formats (format != 2)', () => {
    expectDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 1\nlayer_0/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemap-unsupported-format', severity: 'warning' }
    );
  });

  it('errors on undecodable layer tile data, naming the layer', () => {
    expectDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)\nlayer_1/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemap-invalid-tile-data', severity: 'error', contains: ['layer_1'] }
    );
  });

  it('accepts a complete TileMap without tilemap diagnostics', () => {
    const diagnostics = lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`,
        TILESET_RESOURCES
      )
    );
    expect(diagnostics.filter((d) => d.ruleName?.includes('tilemap'))).toEqual([]);
  });
});

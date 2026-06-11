/**
 * Semantic lint rules for the legacy TileMap: actionable diagnostics instead
 * of "unknown type" (PRD #74 story 16).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
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
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('warns when a layer has tile data but no tile_set is assigned', () => {
    const diagnostics = linter.lint(
      scene(`format = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`)
    );
    const hit = diagnostics.find((d) => d.ruleName === 'tilemap-requires-tileset');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('warning');
  });

  it('errors when the tile_set resource reference cannot be resolved', () => {
    const diagnostics = linter.lint(
      scene(`tile_set = ExtResource("99")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`)
    );
    const hit = diagnostics.find((d) => d.ruleName === 'valid-tilemap-resources');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('error');
  });

  it('warns on Godot-3-era tile data formats (format != 2)', () => {
    const diagnostics = linter.lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 1\nlayer_0/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      )
    );
    const hit = diagnostics.find((d) => d.ruleName === 'tilemap-unsupported-format');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('warning');
  });

  it('errors on undecodable layer tile data, naming the layer', () => {
    const diagnostics = linter.lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)\nlayer_1/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      )
    );
    const hit = diagnostics.find((d) => d.ruleName === 'tilemap-invalid-tile-data');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('error');
    expect(hit!.message).toContain('layer_1');
  });

  it('accepts a complete TileMap without tilemap diagnostics', () => {
    const diagnostics = linter.lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`,
        TILESET_RESOURCES
      )
    );
    expect(diagnostics.filter((d) => d.ruleName?.includes('tilemap'))).toEqual([]);
  });
});

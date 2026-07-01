/**
 * Semantic lint rules for TileMapLayer: actionable diagnostics instead of
 * "unknown type" (PRD #74 story 16).
 */
import { describe, it, expect } from 'vitest';
import { lint, expectDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

const VALID_DATA = 'PackedByteArray("AAAJAAsAAgABAAAABQA=")';

/** Raw fixture: a TileMapLayer under a World root, with optional resource sections. */
function scene(nodeProps: string, resources = ''): string {
  return `[gd_scene format=3]
${resources}
[node name="World" type="Node2D"]

[node name="L" type="TileMapLayer" parent="."]
${nodeProps}
`;
}

const TILESET_RESOURCES = `
[sub_resource type="TileSet" id="TileSet_a"]
tile_size = Vector2i(16, 16)
`;

describe('TileMapLayer lint rules', () => {
  it('warns when tile data is present but no tile_set is assigned', () => {
    const hit = expectDiagnostic(scene(`tile_map_data = ${VALID_DATA}`), {
      ruleName: 'tilemaplayer-requires-tileset',
      severity: 'warning',
    });
    expect(hit.nodeName).toBe('L');
  });

  it('errors on undecodable tile_map_data', () => {
    expectDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\ntile_map_data = PackedByteArray(0, 0, 1)`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemaplayer-invalid-tile-data', severity: 'error' }
    );
  });

  it('warns on a TileMapLayer with no tile data at all', () => {
    expectDiagnostic(scene(`tile_set = SubResource("TileSet_a")`, TILESET_RESOURCES), {
      ruleName: 'tilemaplayer-empty',
      severity: 'warning',
    });
  });

  it('errors when the tile_set reference cannot be resolved (dangling id)', () => {
    expectDiagnostic(
      scene(`tile_set = SubResource("TileSet_gone")\ntile_map_data = ${VALID_DATA}`),
      { ruleName: 'valid-tilemaplayer-resources', severity: 'error' }
    );
  });

  it('accepts a complete TileMapLayer without tile diagnostics', () => {
    const diagnostics = lint(
      scene(`tile_set = SubResource("TileSet_a")\ntile_map_data = ${VALID_DATA}`, TILESET_RESOURCES)
    );
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('tilemaplayer'))).toEqual([]);
  });
});

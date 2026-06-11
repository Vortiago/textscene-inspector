/**
 * Semantic lint rules for TileMapLayer: actionable diagnostics instead of
 * "unknown type" (PRD #74 story 16).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linter';

const VALID_DATA = 'PackedByteArray("AAAJAAsAAgABAAAABQA=")';

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
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('warns when tile data is present but no tile_set is assigned', () => {
    const diagnostics = linter.lint(scene(`tile_map_data = ${VALID_DATA}`));
    const hit = diagnostics.find((d) => d.ruleName === 'tilemaplayer-requires-tileset');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('warning');
    expect(hit!.nodeName).toBe('L');
  });

  it('errors on undecodable tile_map_data', () => {
    const diagnostics = linter.lint(
      scene(
        `tile_set = SubResource("TileSet_a")\ntile_map_data = PackedByteArray(0, 0, 1)`,
        TILESET_RESOURCES
      )
    );
    const hit = diagnostics.find((d) => d.ruleName === 'tilemaplayer-invalid-tile-data');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('error');
  });

  it('warns on a TileMapLayer with no tile data at all', () => {
    const diagnostics = linter.lint(
      scene(`tile_set = SubResource("TileSet_a")`, TILESET_RESOURCES)
    );
    const hit = diagnostics.find((d) => d.ruleName === 'tilemaplayer-empty');
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('warning');
  });

  it('accepts a complete TileMapLayer without tile diagnostics', () => {
    const diagnostics = linter.lint(
      scene(`tile_set = SubResource("TileSet_a")\ntile_map_data = ${VALID_DATA}`, TILESET_RESOURCES)
    );
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('tilemaplayer'))).toEqual([]);
  });
});

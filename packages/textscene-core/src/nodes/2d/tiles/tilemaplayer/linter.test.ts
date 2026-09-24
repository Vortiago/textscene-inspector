/**
 * Semantic lint rules for TileMapLayer: actionable diagnostics instead of
 * "unknown type".
 */
import { describe, it, expect } from 'vitest';
import { lint, expectDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
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
  it('reports when tile data is present but no tile_set is assigned', () => {
    const hit = expectDiagnostic(scene(`tile_map_data = ${VALID_DATA}`), {
      ruleName: 'tilemaplayer-requires-tileset',
      severity: 'info',
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

  it('reports a malformed base64 body once, not once per layer that reads it', () => {
    // The literal cannot be parsed (`CryptoCore::b64_decode` failing is an
    // ERR_PARSE_ERROR for the whole file, variant_parser.cpp:618-622), so the
    // semantic decode never gets a value to judge and must stay quiet.
    const diagnostics = lint(
      scene(
        `tile_set = SubResource("TileSet_a")\ntile_map_data = PackedByteArray("not base64!!")`,
        TILESET_RESOURCES
      )
    );
    const onTileData = diagnostics.filter(
      (d) => d.severity === 'error' && /tile_map_data/.test(d.message)
    );
    expect(onTileData).toHaveLength(1);
    expect(onTileData[0]?.message).toContain('base64');
  });

  it('stays silent on a TileMapLayer with no tile data at all', () => {
    const diagnostics = lint(scene(`tile_set = SubResource("TileSet_a")`, TILESET_RESOURCES));
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('tilemaplayer'))).toEqual([]);
  });

  it('errors when the tile_set reference cannot be resolved (dangling id)', () => {
    expectDiagnostic(
      scene(`tile_set = SubResource("TileSet_gone")\ntile_map_data = ${VALID_DATA}`),
      { ruleName: 'dangling-resource-reference', severity: 'error' }
    );
  });

  it('accepts a complete TileMapLayer without tile diagnostics', () => {
    const diagnostics = lint(
      scene(`tile_set = SubResource("TileSet_a")\ntile_map_data = ${VALID_DATA}`, TILESET_RESOURCES)
    );
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('tilemaplayer'))).toEqual([]);
  });
});

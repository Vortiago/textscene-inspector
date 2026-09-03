/**
 * Semantic lint rules for the legacy TileMap: actionable diagnostics instead
 * of "unknown type".
 */
import { describe, it, expect } from 'vitest';
import { lint, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
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
  it('reports when a layer has tile data but no tile_set is assigned', () => {
    expectDiagnostic(scene(`format = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`), {
      ruleName: 'tilemap-requires-tileset',
      severity: 'info',
    });
  });

  it('errors when the tile_set resource reference cannot be resolved', () => {
    expectDiagnostic(
      scene(`tile_set = ExtResource("99")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`),
      { ruleName: 'dangling-resource-reference', severity: 'error' }
    );
  });

  it('warns on Godot-3-era tile data formats (format != 2)', () => {
    expectDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 1\nlayer_0/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemap-unsupported-format', severity: 'error' }
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

  it('accepts a complete TileMap with only the unconditional deprecation warning', () => {
    const diagnostics = lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 2\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`,
        TILESET_RESOURCES
      )
    );
    expect(diagnostics.filter((d) => d.ruleName?.includes('tilemap')).map((d) => d.ruleName)).toEqual([
      'tilemap-deprecated',
    ]);
  });

  describe('deprecation (tile_map.cpp:843)', () => {
    it('warns unconditionally, even on an empty TileMap', () => {
      expectDiagnostic(scene(''), { ruleName: 'tilemap-deprecated', severity: 'warning' });
    });
  });

  describe('Y-sort / Z-index consistency (tile_map.cpp:850-882)', () => {
    it('warns when a Y-sorted layer shares a Z-index with a non-Y-sorted layer', () => {
      expectDiagnostic(
        scene(`layer_0/y_sort_enabled = true\nlayer_1/name = "Other"`),
        { ruleName: 'tilemap-y-sort-z-index-conflict', severity: 'warning' }
      );
    });

    // No `layer_0/…` key at all, yet the loaded node still has Layer0: the
    // constructor pushes it before any property is applied (tile_map.cpp:1014-1021),
    // and it defaults to not-y-sorted at z_index 0 — the exact collision partner
    // for a y-sorted layer_1 at z_index 0.
    it('warns when a y-sorted layer collides with the constructor’s keyless Layer0', () => {
      expectDiagnostic(scene(`layer_1/y_sort_enabled = true`), {
        ruleName: 'tilemap-y-sort-z-index-conflict',
        severity: 'warning',
      });
    });

    it('stays quiet when only one layer is configured with y_sort_enabled', () => {
      const diagnostics = lint(scene(`layer_0/y_sort_enabled = true`));
      expect(diagnostics.filter((d) => d.ruleName === 'tilemap-y-sort-z-index-conflict')).toEqual([]);
    });

    it('stays quiet when the Y-sorted and non-Y-sorted layers have different Z-indices', () => {
      const diagnostics = lint(
        scene(`layer_0/y_sort_enabled = true\nlayer_0/z_index = 1\nlayer_1/z_index = 2`)
      );
      expect(diagnostics.filter((d) => d.ruleName === 'tilemap-y-sort-z-index-conflict')).toEqual([]);
    });

    it('warns when a layer is Y-sorted but the TileMap node itself is not', () => {
      expectDiagnostic(scene(`layer_0/y_sort_enabled = true`), {
        ruleName: 'tilemap-layer-y-sort-without-node',
        severity: 'warning',
      });
    });

    it('stays quiet when both the node and its layer are Y-sorted', () => {
      const diagnostics = lint(scene(`y_sort_enabled = true\nlayer_0/y_sort_enabled = true`));
      expect(diagnostics.filter((d) => d.ruleName === 'tilemap-layer-y-sort-without-node')).toEqual([]);
    });

    it('warns when the TileMap node is Y-sorted but no layer is (including no layers at all)', () => {
      expectDiagnostic(scene(`y_sort_enabled = true`), {
        ruleName: 'tilemap-node-y-sort-without-layer',
        severity: 'warning',
      });
    });

    it('stays quiet when the node is Y-sorted and at least one layer is too', () => {
      const diagnostics = lint(scene(`y_sort_enabled = true\nlayer_0/y_sort_enabled = true`));
      expect(diagnostics.filter((d) => d.ruleName === 'tilemap-node-y-sort-without-layer')).toEqual([]);
    });

    it('treats an absent layer sub-key at its TileMapLayer default (y_sort_enabled false, z_index 0)', () => {
      // layer_1 has only a `name`, no y_sort_enabled/z_index of its own — it
      // must still count as a (non-Y-sorted, z_index 0) layer.
      const diagnostics = lint(scene(`y_sort_enabled = true\nlayer_1/name = "Bare"`));
      expect(diagnostics.filter((d) => d.ruleName === 'tilemap-node-y-sort-without-layer')).toHaveLength(1);
    });
  });
});

describe('format, read as it stood when each layer loaded', () => {
  // `TileMap::_set` stores `format` only from a `Variant::INT`
  // (tile_map.cpp:688-691) and otherwise falls through to `return false`
  // (:724): a FLOAT or BOOL spelling is a dropped write and the member keeps
  // its initial TILE_MAP_DATA_FORMAT_3 (tile_map.h:64). Probed on 4.6.3:
  // `format = 1.0` above a one-cell layer loads that cell.
  it('reports a FLOAT-spelled format once, as a dropped write, and still decodes the data at 2', () => {
    const diagnostics = lint(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 1.0\nlayer_0/tile_data = PackedInt32Array(0, 0)`,
        TILESET_RESOURCES
      )
    );
    expect(diagnostics.filter((d) => d.ruleName === 'tilemap-unsupported-format')).toEqual([]);
    const onFormat = diagnostics.filter((d) => d.message.includes("'format'"));
    expect(onFormat.map((d) => d.severity)).toEqual(['error']);
    expect(onFormat[0]!.message).toContain('dropped');
    expect(diagnostics.filter((d) => d.ruleName === 'tilemap-invalid-tile-data')).toHaveLength(1);
  });

  // Properties apply in file order (packed_scene.cpp:369-492): a `format`
  // below `layer_0/tile_data` reaches `_set` after the data has already been
  // decoded at 2. Probed on 4.6.3: the layer keeps its cell.
  it('stays quiet about a legacy format written below the tile data it would have governed', () => {
    expectNoDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)\nformat = 1`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemap-unsupported-format' }
    );
  });

  it('errors on the same legacy format written above the tile data', () => {
    expectDiagnostic(
      scene(
        `tile_set = SubResource("TileSet_a")\nformat = 1\nlayer_0/tile_data = PackedInt32Array(0, 0, 0)`,
        TILESET_RESOURCES
      ),
      { ruleName: 'tilemap-unsupported-format', severity: 'error' }
    );
  });
});

describe('tile data phase 1 already refused', () => {
  it('reports a malformed tile_data literal exactly once', () => {
    const diagnostics = lint(
      scene(`tile_set = SubResource("TileSet_a")\nlayer_0/tile_data = PackedInt32Array(a)`, TILESET_RESOURCES)
    );
    expect(diagnostics.filter((d) => d.message.includes('tile_data'))).toHaveLength(1);
  });
});

describe('TileMap index grammar', () => {
  it('counts a `+`-signed layer index, which TileMap resolves', () => {
    // `TileMap::_set` gates on `property_helper.is_property_valid`
    // (tile_map.cpp:700), whose index gate is `String::is_valid_int()`
    // (property_list_helper.cpp:126) — one leading sign allowed, `+` as
    // readily as `-` (ustring.cpp:4752). `layer_+1/y_sort_enabled` therefore
    // Y-sorts layer 1.
    expectDiagnostic(scene(`layer_+1/y_sort_enabled = true`), {
      ruleName: 'tilemap-layer-y-sort-without-node',
      severity: 'warning',
    });
  });

  it('builds no layer for a negative index', () => {
    // Re-narrowing fence, not a red-green test: widening the grammar to admit
    // a sign is what first let `layer_-1/…` through the match. `_get_property`
    // returns null for `index < 0` (property_list_helper.cpp:58), so
    // `property_set_value` refuses the write and no such layer exists.
    //
    // Asserted through the node-Y-sort warning, which is the one that
    // DISTINGUISHES a dropped index from the constructor's Layer0: a leaked
    // layer -1 would be a Y-sorted layer and silence it, while Layer0's
    // defaults leave it firing.
    expectDiagnostic(scene(`y_sort_enabled = true\nlayer_-1/y_sort_enabled = true`), {
      ruleName: 'tilemap-node-y-sort-without-layer',
      severity: 'warning',
    });
    const diagnostics = lint(scene(`layer_-1/y_sort_enabled = true`));
    expect(diagnostics.filter((d) => d.ruleName === 'tilemap-layer-y-sort-without-node')).toEqual([]);
  });

  it('counts the layer Godot builds for a skipped index in the y-sort conflict', () => {
    // `_set`'s grow loop builds layer 1 at TileMapLayer's defaults — not
    // y-sorted, z_index 0 — and `get_configuration_warnings` iterates that real
    // vector (tile_map.cpp:848), so it shares a z-index with the sorted layers.
    expectDiagnostic(
      scene(`y_sort_enabled = true
layer_0/y_sort_enabled = true
layer_2/y_sort_enabled = true`),
      { ruleName: 'tilemap-y-sort-z-index-conflict' }
    );
  });

  it('seats no layer for a key whose index text carries a slash', () => {
    // `layer_9/tile_data/x` rsplits to the index text `9/tile_data`, which fails
    // `is_valid_int`, so `_set` builds nothing (property_list_helper.cpp:47-53).
    expect(
      lint(
        scene(`y_sort_enabled = true
layer_0/y_sort_enabled = true
layer_9/tile_data/x = 1`)
      ).filter((d) => d.ruleName === 'tilemap-y-sort-z-index-conflict')
    ).toEqual([]);
  });
});

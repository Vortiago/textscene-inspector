/**
 * Semantic linter rules for TileMapLayer. Format validation (reference syntax,
 * booleans) lives in linterParser.ts; these rules use scene context and the
 * shared tile-data decoder.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { decodeTileMapData } from '../shared/tileData.js';

function checkTileMapLayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  if (rawProps.tile_map_data && resourceSlotIsEmpty(rawProps.tile_set)) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMapLayer has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemaplayer-requires-tileset',
    });
  }

  if (rawProps.tile_map_data !== undefined && decodeTileMapData(rawProps.tile_map_data) === null) {
    diagnostics.push({
      severity: 'error',
      message: `'tile_map_data' is not a decodable PackedByteArray (2-byte header + 12-byte cell records).`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemaplayer-invalid-tile-data',
    });
  }

  return diagnostics;
}

const tileMapLayerValidationRule: LintRule = {
  meta: {
    name: 'valid-tilemaplayer',
    description: 'Validates TileMapLayer tile_set assignment and tile data integrity',
    category: 'validation',
    applicableNodeTypes: ['TileMapLayer'],
    emits: [
      {
        ruleName: 'tilemaplayer-requires-tileset',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'tile_map_layer.cpp:224',
          unused: 'a null tile set forces the cleanup path, so nothing is drawn',
        },
      },
      {
        ruleName: 'tilemaplayer-invalid-tile-data',
        severity: 'error',
        grounding: { kind: 'engine', at: 'tile_map_layer.cpp:3239' },
      },
    ],
  },
  check: checkTileMapLayer,
};

ruleRegistry.register(tileMapLayerValidationRule);

export { tileMapLayerValidationRule };

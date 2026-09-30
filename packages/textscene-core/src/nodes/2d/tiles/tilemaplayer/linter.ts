/**
 * Semantic linter rules for TileMapLayer. Format validation (reference syntax,
 * booleans) lives in linterParser.ts. These rules use scene context and the
 * shared tile-data decoder.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armEmits, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { decodeTileMapData, readTileMapDataLiteral } from '../shared/tileData.js';

const arms = {
  missingTileSet: {
    severity: 'info',
    ruleName: 'tilemaplayer-requires-tileset',
    grounding: {
      kind: 'engine-inert',
      at: 'tile_map_layer.cpp:224',
      unused: 'a null tile set forces the cleanup path, so nothing is drawn',
    },
  },
  invalidTileData: {
    severity: 'error',
    ruleName: 'tilemaplayer-invalid-tile-data',
    grounding: { kind: 'engine', at: 'tile_map_layer.cpp:3239' },
  },
} as const satisfies RuleArms<'missingTileSet' | 'invalidTileData'>;

function checkTileMapLayer(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  if (rawProps.tile_map_data && resourceSlotIsEmpty(rawProps.tile_set)) {
    reportArm(
      diagnostics,
      arms.missingTileSet,
      node,
      `TileMapLayer has tile data but no 'tile_set' — its tiles cannot render.`
    );
  }

  // A literal the text parser cannot read is the property validator's to
  // report: the file does not load at all, so what the bytes would have meant
  // is not a question this rule gets to ask.
  const tileData = rawProps.tile_map_data;
  if (
    tileData !== undefined &&
    readTileMapDataLiteral(tileData).fault === null &&
    decodeTileMapData(tileData) === null
  ) {
    reportArm(
      diagnostics,
      arms.invalidTileData,
      node,
      `'tile_map_data' is not a decodable PackedByteArray (2-byte header + 12-byte cell records).`
    );
  }

  return diagnostics;
}

const tileMapLayerValidationRule: LintRule = {
  meta: {
    name: 'valid-tilemaplayer',
    description: 'Validates TileMapLayer tile_set assignment and tile data integrity',
    category: 'validation',
    applicableNodeTypes: ['TileMapLayer'],
    emits: armEmits(arms),
  },
  check: checkTileMapLayer,
};

ruleRegistry.register(tileMapLayerValidationRule);

export { tileMapLayerValidationRule };

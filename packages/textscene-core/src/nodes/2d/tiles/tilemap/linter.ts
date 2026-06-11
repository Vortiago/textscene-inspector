/**
 * Semantic linter rules for the legacy TileMap. Format validation lives in
 * linterParser.ts; these rules use scene context and the shared tile-data
 * decoder, walking the dynamic `layer_N/...` property groups.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';
import { decodeLegacyTileData } from '../shared/tileData.js';

const LAYER_DATA_KEY_RE = /^layer_(\d+)\/tile_data$/;

function checkTileMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (node.type !== 'TileMap') return diagnostics;

  const rawProps = node.properties as unknown as Record<string, string>;
  const layerData = Object.entries(rawProps).filter(([key]) => LAYER_DATA_KEY_RE.test(key));
  const format = rawProps.format !== undefined ? parseInt(rawProps.format, 10) : 0;

  if (layerData.length > 0 && !rawProps.tile_set) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMap has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-requires-tileset',
    });
  }

  if (rawProps.tile_set && !checkResourceExists(scene, rawProps.tile_set)) {
    diagnostics.push({
      severity: 'error',
      message: `TileSet resource not found: ${rawProps.tile_set}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-tilemap-resources',
    });
  }

  if (layerData.length > 0 && format !== 2) {
    diagnostics.push({
      severity: 'warning',
      message:
        `TileMap 'format = ${format}' is a Godot 3 tile data format — ` +
        `only format 2 (Godot 4) renders.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-unsupported-format',
    });
  } else {
    for (const [key, value] of layerData) {
      if (decodeLegacyTileData(value, format) === null) {
        diagnostics.push({
          severity: 'error',
          message: `'${key}' is not a decodable PackedInt32Array of cell triplets (${key.replace('/tile_data', '')}).`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'tilemap-invalid-tile-data',
        });
      }
    }
  }

  return diagnostics;
}

const tileMapValidationRule: LintRule = {
  meta: {
    name: 'valid-tilemap',
    description: 'Validates TileMap tile_set assignment, data format, and per-layer tile data',
    category: 'validation',
    applicableNodeTypes: ['TileMap'],
  },
  check: checkTileMap,
};

ruleRegistry.register(tileMapValidationRule);

export { tileMapValidationRule };

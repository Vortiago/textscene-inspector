/**
 * Semantic linter rules for Decal.
 *
 * Format validation (size/modulate/fade ranges, cull_mask bounds) lives in
 * linterParser.ts. This file covers scene-context checks: that referenced
 * textures resolve, and that a decal projects at least one texture (a decal
 * with no textures is valid in Godot but renders nothing — worth a warning).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

const TEXTURE_PROPS = [
  'texture_albedo',
  'texture_normal',
  'texture_orm',
  'texture_emission',
] as const;

function checkDecal(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  const rawProps = node.properties as unknown as Record<string, string>;

  const referencedTextures = TEXTURE_PROPS.filter((prop) => rawProps[prop]);

  // A decal with no texture at all projects nothing — valid in Godot, but
  // almost certainly a mistake, so flag it as a warning.
  if (referencedTextures.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message:
        "Decal has no texture (e.g. 'texture_albedo'). It will project nothing and is not visible.",
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'decal-requires-texture',
    });
  }

  // Each referenced texture must resolve to a declared resource.
  for (const prop of referencedTextures) {
    if (!checkResourceExists(scene, rawProps[prop]!)) {
      diagnostics.push({
        severity: 'error',
        message: `Texture resource not found: ${rawProps[prop]} (${prop})`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-decal-resources',
      });
    }
  }

  return diagnostics;
}

const decalValidationRule: LintRule = {
  meta: {
    name: 'valid-decal-resources',
    description: 'Validates Decal texture references resolve and that a decal projects at least one texture',
    category: 'validation',
    emits: [
      { ruleName: 'decal-requires-texture', severity: 'warning' },
      { ruleName: 'valid-decal-resources', severity: 'error' },
    ],
    applicableNodeTypes: ['Decal'],
  },
  check: checkDecal,
};

ruleRegistry.register(decalValidationRule);

export { decalValidationRule };

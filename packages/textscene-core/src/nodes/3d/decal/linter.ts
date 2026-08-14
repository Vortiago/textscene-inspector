/**
 * Semantic linter rules for Decal.
 *
 * Format validation (size/modulate/fade ranges, cull_mask bounds) lives in
 * linterParser.ts. This file covers scene-context checks: that referenced
 * textures resolve, and three of Decal's own `get_configuration_warnings()`
 * checks (decal.cpp:184-193):
 *
 *     if (textures[TEXTURE_ALBEDO].is_null() && textures[TEXTURE_NORMAL].is_null()
 *             && textures[TEXTURE_ORM].is_null() && textures[TEXTURE_EMISSION].is_null()) {
 *         warnings.push_back(RTR("no textures loaded ..."));
 *     }
 *     if ((textures[TEXTURE_NORMAL].is_valid() || textures[TEXTURE_ORM].is_valid())
 *             && textures[TEXTURE_ALBEDO].is_null()) {
 *         warnings.push_back(RTR("has a Normal and/or ORM texture, but no Albedo texture ..."));
 *     }
 *     if (cull_mask == 0) {
 *         warnings.push_back(RTR("Cull Mask has no bits enabled ..."));
 *     }
 *
 * The renderer-method check at decal.cpp:179 (`gl_compatibility`/`dummy`) is
 * runtime-only and not modelled — same as `decal-requires-texture` already
 * ignores its own EARLY RETURN in that branch (decal.cpp:180).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, resourceSlotIsEmpty } from '../../../linter/resourceChecker.js';
import { parseGodotInt } from '../../../linter/validators/commonValidators.js';

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

  const referencedTextures = TEXTURE_PROPS.filter((prop) => !resourceSlotIsEmpty(rawProps[prop]));

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

  // decal.cpp:188: a Normal/ORM map blends onto the Albedo texture's alpha
  // channel, so it does nothing without one.
  if (
    (!resourceSlotIsEmpty(rawProps.texture_normal) ||
      !resourceSlotIsEmpty(rawProps.texture_orm)) &&
    resourceSlotIsEmpty(rawProps.texture_albedo)
  ) {
    diagnostics.push({
      severity: 'warning',
      message:
        'Decal has a Normal and/or ORM texture, but no Albedo texture. An Albedo texture with an alpha channel is required to blend the normal/ORM maps onto the underlying surface.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'decal-normal-orm-without-albedo',
    });
  }

  // decal.cpp:191-192. Default cull_mask is (1 << 20) - 1 (decal.h:54), so an
  // absent key never trips this — only an explicit 0.
  if (rawProps.cull_mask !== undefined && parseGodotInt(rawProps.cull_mask) === 0) {
    diagnostics.push({
      severity: 'warning',
      message:
        "Decal's Cull Mask has no bits enabled, so the decal will not paint objects on any layer. Enable at least one bit in the Cull Mask property.",
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'decal-empty-cull-mask',
    });
  }

  return diagnostics;
}

const decalValidationRule: LintRule = {
  meta: {
    name: 'valid-decal-resources',
    description:
      'Validates Decal texture references resolve, and three of get_configuration_warnings\' own checks: at least one texture, Normal/ORM without Albedo, and an empty Cull Mask',
    category: 'validation',
    emits: [
      { ruleName: 'decal-requires-texture', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-decal-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the texture id is undeclared in the file',
        },
      },
      { ruleName: 'decal-normal-orm-without-albedo', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'decal-empty-cull-mask', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
    applicableNodeTypes: ['Decal'],
  },
  check: checkDecal,
};

ruleRegistry.register(decalValidationRule);

export { decalValidationRule };

/**
 * Semantic linter rules for Path2D.
 *
 * Format validation (the `curve` reference format) is handled by linterParser.ts
 * during strict parsing. This file covers the one semantic check that needs
 * scene context: the referenced Curve2D exists.
 *
 * Divergence from Path3D (which ERRORs on a missing curve): in real 2D games a
 * Path2D's curve is frequently assigned at runtime via an attached script (e.g.
 * godot-open-rpg's gamepiece.tscn), so a missing `curve` is a WARNING and is
 * suppressed entirely when the node has a `script`.
 *
 * No "no PathFollow2D children" check: `path_2d.h`/`path_2d.cpp` declare a
 * `get_configuration_warnings()` override only on `PathFollow2D`, never on
 * `Path2D` itself — Godot raises no warning for a followerless Path2D, and
 * Godot's own tween demo deliberately drives one from script with no follower.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../linter/resourceChecker.js';

function checkPath2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.properties as unknown as Record<string, string>;

  const curve = heldResource(rawProps.curve);
  if (curve === undefined) {
    // A script commonly assigns the curve at runtime — don't warn in that case.
    // The exemption needs a script that actually LOADS: read raw, `'null'` is a
    // truthy string, so a cleared slot claimed one, and a reference the scene
    // never declares claimed one too.
    const script = heldResource(rawProps.script);
    if (script === undefined || !checkResourceExists(scene, script)) {
      diagnostics.push({
        severity: 'warning',
        message: `Path2D '${node.name}' has no 'curve'. It will draw nothing until a Curve2D is assigned (often set at runtime via script).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'path2d-missing-curve',
      });
    }
  }

  return diagnostics;
}

const path2DValidationRule: LintRule = {
  meta: {
    name: 'valid-path2d',
    description: 'Validates Path2D curve resource references',
    category: 'validation',
    applicableNodeTypes: ['Path2D'],
    emits: [
      {
        ruleName: 'path2d-missing-curve',
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'path_2d.cpp:161',
          unused: 'the debug pass has already cleared the mesh and returns without refilling it',
        },
      },
    ],
  },
  check: checkPath2D,
};

ruleRegistry.register(path2DValidationRule);

export { path2DValidationRule };

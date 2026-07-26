/**
 * Semantic linter rules for Path3D
 *
 * Note: Format validation (curve resource reference format) is handled by linterParser.ts
 * during strict parsing. This file focuses on semantic validation that requires
 * full scene context (e.g., curve resource exists, PathFollow3D children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnInternalResource, TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../linter/resourceChecker.js';

/**
 * Check if a node has any PathFollow3D children
 */
function hasPathFollowChildren(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'PathFollow3D') {
      return true;
    }
    // Recursively check nested children
    if (hasPathFollowChildren(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate Path3D semantic rules
 */
function checkPath3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for Path3D nodes
  if (node.type !== 'Path3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // ERROR: curve property is REQUIRED
  if (!rawProps.curve) {
    diagnostics.push({
      severity: 'error',
      message: `Path3D '${node.name}' is missing required property 'curve'. A Path3D without a Curve3D resource is useless.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path3d-requires-curve',
    });
  } else {
    // ERROR: Check if curve resource exists in scene
    const resourceExists = checkResourceExists(scene, rawProps.curve);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Curve resource not found: ${rawProps.curve}. The referenced Curve3D resource must exist in the scene.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-path3d-resources',
      });
    } else {
      diagnostics.push(...checkCurve3DData(context, rawProps.curve));
    }
  }

  // WARNING: nothing in the scene appears to consume this path.
  // PathFollow3D descendants are the usual consumer, but a CSGPolygon3D in PATH
  // mode extrudes along a Path3D it names through `path_node` and needs no
  // PathFollow3D at all — a first-class Godot pattern that two vendored scenes
  // use, and that this rule used to warn about.
  if (!hasPathFollowChildren(node) && !isReferencedByPathNode(context.scene, node.name)) {
    diagnostics.push({
      severity: 'warning',
      message: `Path3D '${node.name}' has no PathFollow3D children. While paths can be used programmatically, they are typically followed by PathFollow3D nodes. Consider adding a PathFollow3D child if you intend to animate objects along this path.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'path3d-unused',
    });
  }

  return diagnostics;
}

/**
 * Validate the referenced Curve3D's `_data` against what Godot will actually load.
 *
 * `Curve3D::_set_data` (`scene/resources/curve.cpp:2278-2299`) hard-fails on a missing
 * `points` or `tilts` key, and on a `points` array whose length is not a multiple of
 * three Vector3s (in / out / position per control point). A curve that fails to load
 * comes back with ZERO points, so the Path3D silently draws nothing and any CSGPolygon3D
 * sweeping along it produces no geometry at all.
 *
 * This is worth a rule because it is invisible to everything else we have: our lenient
 * parser reads such a curve happily, the strict parser sees well-formed TSCN, and the
 * scene renders here while rendering EMPTY in Godot. That exact mistake was made while
 * authoring a swept-path scene and only surfaced from a pixel comparison
 * against a real Godot render.
 *
 * Errors rather than warnings: Godot refuses to load the resource, so this is not an
 * advisory style question.
 */
function checkCurve3DData(context: RuleContext, curveRef: string): Diagnostic[] {
  const { node, scene } = context;
  const id = curveRef.match(/SubResource\s*\(\s*"([^"]+)"\s*\)/)?.[1];
  if (!id) return [];

  const resource = scene.internalResources?.find(
    (r: TscnInternalResource) => r.id === id && r.type === 'Curve3D'
  );
  if (!resource) return [];

  const data = (resource.data as Record<string, string>)['_data'];
  if (typeof data !== 'string') return [];

  const problem = (message: string): Diagnostic => ({
    severity: 'error',
    message: `Path3D '${node.name}': ${message}`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'curve3d-loadable',
  });

  const pointsLiteral = data.match(/"points"\s*:\s*PackedVector3Array\(([^)]*)\)/);
  if (!pointsLiteral) {
    return [problem("its Curve3D has no \"points\" in `_data`; Godot loads the curve with zero points and the path draws nothing.")];
  }
  if (!/"tilts"\s*:/.test(data)) {
    return [
      problem(
        'its Curve3D has no "tilts" in `_data`. Godot requires both "points" and "tilts" ' +
          '(curve.cpp:2279-2280) and loads the curve with zero points without it, so the path ' +
          'silently disappears even though the scene looks valid.'
      ),
    ];
  }

  const floats = pointsLiteral[1]!.split(',').filter((s) => s.trim() !== '').length;
  const vector3s = floats / 3;
  if (floats % 3 !== 0 || vector3s % 3 !== 0) {
    return [
      problem(
        `its Curve3D "points" holds ${floats} floats; Godot needs a whole number of control ` +
          'points at nine floats each (in / out / position) and rejects the resource otherwise.'
      ),
    ];
  }

  const tiltsLiteral = data.match(/"tilts"\s*:\s*PackedFloat32Array\(([^)]*)\)/);
  if (tiltsLiteral) {
    const tilts = tiltsLiteral[1]!.split(',').filter((s) => s.trim() !== '').length;
    const expected = vector3s / 3;
    if (tilts !== expected) {
      return [
        problem(
          `its Curve3D has ${tilts} tilt values for ${expected} control points; Godot indexes ` +
            'tilts by point and reads past the end when there are too few.'
        ),
      ];
    }
  }

  return [];
}

/**
 * Path3D semantic validation rule
 */
const path3DValidationRule: LintRule = {
  meta: {
    name: 'valid-path3d',
    description: 'Validates Path3D curve resource references and checks for PathFollow3D children',
    category: 'validation',
    applicableNodeTypes: ['Path3D'],
    emits: [
      { ruleName: 'path3d-requires-curve', severity: 'error' },
      { ruleName: 'valid-path3d-resources', severity: 'error' },
      { ruleName: 'path3d-unused', severity: 'warning' },
      { ruleName: 'curve3d-loadable', severity: 'error' },
    ],
  },
  check: checkPath3D,
};

// Self-register the rule
ruleRegistry.register(path3DValidationRule);

// Export for testing
export { path3DValidationRule };

/**
 * Is any node in the scene pointing a `path_node` NodePath at this Path3D?
 *
 * Matched by the NodePath's FINAL SEGMENT rather than resolved properly: the
 * linter reads a single static scene, where an instanced sub-scene's internals
 * are opaque and a relative NodePath may leave the file entirely. A false
 * negative (staying quiet about a genuinely unused path) is much cheaper here
 * than warning about a correct scene.
 */
function isReferencedByPathNode(scene: TscnScene, pathName: string): boolean {
  let found = false;
  const visit = (nodes: readonly TscnNode[]): void => {
    for (const n of nodes) {
      const raw = (n.properties as Record<string, unknown>).path_node;
      if (typeof raw === 'string' && nodePathLeaf(raw) === pathName) found = true;
      if (n.children.length > 0) visit(n.children);
    }
  };
  visit(scene.nodes);
  return found;
}

/** Last segment of a `NodePath("a/b/Target")` literal, or the raw string. */
function nodePathLeaf(raw: string): string {
  const inner = raw.match(/^NodePath\s*\(\s*"([^"]*)"\s*\)$/)?.[1] ?? raw;
  const segments = inner.split('/').filter((s) => s.length > 0 && s !== '..' && s !== '.');
  return segments[segments.length - 1] ?? '';
}

/**
 * One diagnostic per `[node]` heading whose `parent=` names nothing. The builder re-roots such a
 * node where Godot does, and Phase 2 then runs its semantic rules. Where Godot does not, the node
 * and its descendants escape every semantic rule. Phase 1 validates during the scan and is
 * unaffected. Tiers and citations are declared in `fileDiagnostics.ts`, where `emitsGrounding`
 * sweeps them.
 */

import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { reparentedName } from '../godot/scene/packedScene.js';
import type { NodeOrigin, RawNode, StrictScene } from '../parser/types.js';
import { resolveExtResourcePath } from '../resources/SubResourceResolver.js';
import { SCENE_ROOT_PATH } from '../utils/nodePath.js';

/**
 * What Godot does with the heading's `parent_id_path=`, or undefined where the trail
 * recovers nothing and the node is re-rooted (`packed_scene.cpp:1947-2005`).
 */
function idRecoveryOutcome(scene: StrictScene, origin: NodeOrigin<RawNode>): string | undefined {
  const recovery = scene.idRecoveries.get(origin);
  if (recovery === undefined) return undefined;
  const lead =
    'The heading also carries parent_id_path, the id trail Godot falls back to when a path ' +
    'does not walk (packed_scene.cpp:161-163).';
  if (recovery.kind === 'lands') {
    const where =
      recovery.viaPath === SCENE_ROOT_PATH
        ? 'the scene root'
        : `"${recovery.viaPath ?? recovery.via.node.name}"`;
    return `${lead} Its first id names the node '${recovery.via.node.name}' (line ${recovery.via.line}), so the node lands under ${where} and keeps its name.`;
  }
  const instanced =
    resolveExtResourcePath(recovery.via.node.instance, scene.externalResources) ?? 'an instanced scene';
  return (
    `${lead} Its first id names the instance '${recovery.via.node.name}' of ${instanced}, and the rest ` +
    'of the trail lives in that scene, which this linter does not open, so it cannot say where the node lands.'
  );
}

/**
 * What Godot does with an orphan. The empty path is its own outcome because the verb differs:
 * that heading faults the load, so the instantiate the re-root belongs to is never reached.
 */
function orphanOutcome(scene: StrictScene, origin: NodeOrigin<RawNode>, hasEmptyParent: boolean): string {
  if (hasEmptyParent) {
    return (
      'Godot cannot load the file at all — another heading spells parent="" (see the ' +
      'error beside this) — so nothing in it is instantiated.'
    );
  }
  if (scene.refusesToInstantiate) {
    return (
      'Godot refuses to instantiate the scene for another heading (see the error ' +
      'beside this), so no re-root of this node happens.'
    );
  }
  return (
    idRecoveryOutcome(scene, origin) ??
    `Godot re-parents it to the scene root and renames it "${renamedTo(scene, origin)}".`
  );
}

/** Godot's name for the orphan: the one the builder gave it, else the spelling it would give. */
function renamedTo(scene: StrictScene, origin: NodeOrigin<RawNode>): string {
  return scene.reRootedNames.get(origin) ?? reparentedName(origin.declaredParent!, origin.node.name);
}

/**
 * Godot warns and recovers from a vanished path (the rename is `packed_scene.cpp:561-563`),
 * but refuses the instantiate for a parentless later heading or a root that declares a
 * parent, so one warns and the others error. Both `ERR_FAIL_COND_V_MSG`s (`:207`, `:219`)
 * exit the loop the re-root (`:208-215`) runs in, so any refusal voids every rename.
 */
export function orphanDiagnostics(scene: StrictScene): Diagnostic[] {
  // Positional, and ahead of every claim below: a heading spelling `parent=""`
  // faults the loader itself, so no node is built and none of the instantiate
  // refusals is ever reached. Such a heading carries no `node.parent`, which is
  // why it reaches neither `rootWithParent` alone nor `orphanedNodes` alone.
  const emptyParents = scene.emptyParentHeadings;
  const emptyNodes = new Set(emptyParents.map(({ node }) => node));
  const emptyRefusals = emptyParents.map(({ node, line }) =>
    armDiagnostic(
      FILE_DIAGNOSTICS.emptyParentPath,
      node,
      `Node '${node.name}' declares parent="", which is not a path. Godot cannot load the ` +
        'file at all: the text loader faults on the empty NodePath while reading this ' +
        'heading, so nothing in the file is parsed.',
      { line, column: 1 }
    )
  );

  const rootOrigin = scene.rootWithParent;
  const rootRefusal: Diagnostic[] =
    rootOrigin && !emptyNodes.has(rootOrigin.node)
      ? [
          armDiagnostic(
            FILE_DIAGNOSTICS.rootDeclaresParent,
            rootOrigin.node,
            `Root node '${rootOrigin.node.name}' declares parent="${rootOrigin.declaredParent}", ` +
              'which only a non-root heading may do. The file loads, but Godot refuses to ' +
              'instantiate the scene from it at all.',
            { line: rootOrigin.line, column: 1 }
          ),
        ]
      : [];

  // Heading 0 is dropped, not reported twice: in `packed_scene.cpp`'s `if (i > 0)`,
  // the missing-parent refusal (`:207`) and the `nparent = ret_nodes[0]` re-root
  // (`:208-215`) both sit in the `i > 0` arm, and heading 0 is refused above. It
  // is orphaned only when its path resolves nowhere and a later heading is parentless.
  const orphans = scene.orphanedNodes.filter(
    (origin) => origin !== rootOrigin && !emptyNodes.has(origin.node)
  );
  // The heading's own attribute, not `node.parent`: both parsers drop an
  // empty `parent=""`, while the loader keeps it. `add_node_path` returns
  // an index for any value the field carries (`packed_scene.cpp:2307-2311`),
  // so `n.parent` is never `-1` for one and the refusal cannot apply to it.
  const missing = ({ declaredParent }: { declaredParent: string | undefined }) =>
    declaredParent === undefined;
  return emptyRefusals.concat(rootRefusal).concat(
    orphans.map((origin) => {
      const { node, line, declaredParent } = origin;
      if (missing(origin)) {
        return armDiagnostic(
          FILE_DIAGNOSTICS.nodeWithoutParent,
          node,
          `Node '${node.name}' declares no 'parent', which only the scene's root node may omit. ` +
            'The file loads, but Godot cannot instantiate the scene from it at all.',
          { line, column: 1 }
        );
      }
      const outcome = orphanOutcome(scene, origin, emptyParents.length > 0);
      // A re-rooted node is in the tree, so Phase 2 ran its rules.
      const rulesSkipped = scene.reRootedNames.has(origin)
        ? ''
        : ' No semantic rule ran on it or on anything parented below it.';
      return armDiagnostic(
        FILE_DIAGNOSTICS.unresolvedParentPath,
        node,
        `Node '${node.name}' declares parent="${declaredParent}", a path this file never defines. ` +
          `${outcome}${rulesSkipped}`,
        { line, column: 1 }
      );
    })
  );
}

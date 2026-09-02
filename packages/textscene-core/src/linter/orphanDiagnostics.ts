/**
 * One diagnostic per `[node]` heading the tree build could not place.
 *
 * Phase 2 walks the tree, so a node missing from it — together with every
 * descendant, whose own path resolves only through it — is skipped by every
 * semantic rule with nothing said. Phase 1 is unaffected: property validation
 * happens during the scan, so the claim below is exactly that narrow.
 *
 * Both tiers and every citation are declared in `fileDiagnostics.ts`, where
 * `emitsGrounding` sweeps them beside the registry's own arms.
 */

import type { TscnScene } from '../parser/types.js';
import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';

/**
 * Godot's own name for a re-parented orphan: the vanished path with `./`
 * stripped and every `/` turned into `@`, then `#` and the node's own name
 * (`packed_scene.cpp:212`, `:561-563`).
 */
function reparentedName(parentPath: string, name: string): string {
  return `${parentPath.replace(/^\.\//, '').replaceAll('/', '@')}#${name}`;
}

/**
 * Godot warns and recovers from a vanished path, and refuses the instantiate
 * outright for a parentless later heading or a root that declares a parent —
 * which is why one is a warning and the others errors. The rename spelling is
 * `packed_scene.cpp:561-563`, one line below the re-root.
 *
 * The re-root is claimed only while nothing refuses: both `ERR_FAIL_COND_V_MSG`s
 * (`:207`, `:218`) return out of the loop the re-root (`:208-215`) runs in, so
 * once any heading trips one, no re-parent or rename of any node survives.
 */
export function orphanDiagnostics(scene: TscnScene): Diagnostic[] {
  const rootOrigin = scene.rootWithParent;
  const rootRefusal: Diagnostic[] = rootOrigin
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

  // Heading 0 is dropped here rather than reported twice: `packed_scene.cpp`
  // reads `if (i > 0) { … } else { … }`, and BOTH claims below live in the
  // `i > 0` arm — the missing-parent refusal at `:207`, and the vanished-path
  // warning with its `nparent = ret_nodes[0]` re-root at `:208-215`. Heading 0
  // takes the `else`, so it is refused outright by the diagnostic above and no
  // rename is performed on it to describe. It is stranded only when its own
  // path resolves against nothing AND a later heading is parentless, which is
  // the case that reported both.
  const stranded = (scene.orphanedNodes ?? []).filter((origin) => origin !== rootOrigin);
  // The heading's own attribute, not `node.parent`: both parsers drop an
  // empty `parent=""`, while the loader keeps it — `add_node_path` returns
  // an index for any value the field carries (`packed_scene.cpp:2307-2311`),
  // so `n.parent` is never `-1` for one and the refusal cannot apply to it.
  const missing = ({ declaredParent }: { declaredParent: string | undefined }) =>
    declaredParent === undefined;
  const refused = rootOrigin !== undefined || stranded.some(missing);

  return rootRefusal.concat(
    stranded.map((origin) => {
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
      const outcome = refused
        ? 'Godot refuses to instantiate the scene for another heading (see the error beside ' +
          'this), so no re-root of this node happens.'
        : `Godot re-parents it to the scene root and renames it "${reparentedName(declaredParent!, node.name)}".`;
      return armDiagnostic(
        FILE_DIAGNOSTICS.unresolvedParentPath,
        node,
        `Node '${node.name}' declares parent="${declaredParent}", a path this file never defines. ` +
          `${outcome} No semantic rule ran on it or on anything parented below it.`,
        { line, column: 1 }
      );
    })
  );
}

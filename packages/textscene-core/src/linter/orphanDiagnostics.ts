/**
 * One diagnostic per `[node]` heading the tree build could not place. Phase 2 walks
 * the tree, so such a node and its descendants escape every semantic rule. Phase 1
 * validates during the scan and is unaffected. Tiers and citations are declared in
 * `fileDiagnostics.ts`, where `emitsGrounding` sweeps them.
 */

import type { TscnScene } from '../parser/types.js';
import type { Diagnostic } from './types.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { armDiagnostic } from './ruleArms.js';
import { nodePathNames } from '../godot/nodePath.js';
import { validateNodeName } from '../godot/nodeName.js';
import { rootStatesNoIdentifier } from '../parser/sceneTreeBuilder.js';

/**
 * Godot's name for a re-parented orphan: the vanished path with `./` stripped, every
 * `/` turned into `@`, then `#` and the node's name (`packed_scene.cpp:212`, `:561-563`).
 * `set_name` stores the validated form, replacing `.`, `:`, `@`, `/`, `"` and `%` with
 * `_` (`node.cpp:1441`), so `Gone/Deeper` renames to `Gone_Deeper#Name`.
 */
function reparentedName(parentPath: string, name: string): string {
  // The prefix is the NodePath's spelling, not the heading's: `:212` reads
  // `String(node_paths[…])`, stored through `prepend_period()` (`resource_format_text.cpp:207`),
  // which inserts a `.` unless one is first and ignores `absolute` (`node_path.cpp:43-49`).
  const names = nodePathNames(parentPath);
  // `prepend_period` skips a NodePath holding no names at all, so `/` stays `/`.
  const withPeriod = names.length === 0 || names[0] === '.' ? names : ['.', ...names];
  // `trim_prefix` removes the added `./` from a relative path. An absolute one keeps
  // its `/` and the period, so `/root/Gone` spells `/./root/Gone`.
  const spelled = (parentPath.startsWith('/') ? '/' : '') + withPeriod.join('/');
  const prefix = spelled.replace(/^\.\//, '').replaceAll('/', '@');
  return validateNodeName(`${prefix}#${name}`);
}

/**
 * Godot warns and recovers from a vanished path (the rename is `packed_scene.cpp:561-563`),
 * but refuses the instantiate for a parentless later heading or a root that declares a
 * parent, so one warns and the others error. Both `ERR_FAIL_COND_V_MSG`s (`:207`, `:219`)
 * exit the loop the re-root (`:208-215`) runs in, so any refusal voids every rename.
 */
export function orphanDiagnostics(scene: TscnScene): Diagnostic[] {
  // Positional, and ahead of every claim below: a heading spelling `parent=""`
  // faults the loader itself, so no node is built and none of the instantiate
  // refusals is ever reached. Such a heading carries no `node.parent`, which is
  // why it reaches neither `rootWithParent` alone nor `orphanedNodes` alone.
  const emptyParents = scene.emptyParentHeadings ?? [];
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
  // strands only when its path resolves nowhere and a later heading is parentless.
  const stranded = (scene.orphanedNodes ?? []).filter(
    (origin) => origin !== rootOrigin && !emptyNodes.has(origin.node)
  );
  // The heading's own attribute, not `node.parent`: both parsers drop an
  // empty `parent=""`, while the loader keeps it. `add_node_path` returns
  // an index for any value the field carries (`packed_scene.cpp:2307-2311`),
  // so `n.parent` is never `-1` for one and the refusal cannot apply to it.
  const missing = ({ declaredParent }: { declaredParent: string | undefined }) =>
    declaredParent === undefined;
  // The third and fourth refusals: a root heading that states no identifier at
  // all, which `:220` fails on, and a placeholder root, which fails the load.
  const refused =
    rootOrigin !== undefined || rootStatesNoIdentifier(scene.nodes[0]) || stranded.some(missing);

  return emptyRefusals.concat(rootRefusal).concat(
    stranded.map((origin) => {
      const { node, line, declaredParent, recoverableById } = origin;
      if (missing(origin)) {
        return armDiagnostic(
          FILE_DIAGNOSTICS.nodeWithoutParent,
          node,
          `Node '${node.name}' declares no 'parent', which only the scene's root node may omit. ` +
            'The file loads, but Godot cannot instantiate the scene from it at all.',
          { line, column: 1 }
        );
      }
      // Three outcomes, and the empty path is its own because the verb differs:
      // that heading faults the load, so the instantiate the re-root belongs to
      // is never reached.
      const outcome = recoverableById
        ? 'The heading also carries parent_id_path, the id trail Godot falls back to when a ' +
          'path does not walk (packed_scene.cpp:161-163). Those ids name nodes inside the base ' +
          'scenes, which this linter does not open, so it cannot say where the node lands.'
        : emptyParents.length > 0
        ? 'Godot cannot load the file at all — another heading spells parent="" (see the ' +
          'error beside this) — so nothing in it is instantiated.'
        : refused
          ? 'Godot refuses to instantiate the scene for another heading (see the error ' +
            'beside this), so no re-root of this node happens.'
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

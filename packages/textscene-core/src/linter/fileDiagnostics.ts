/**
 * The diagnostics `Linter` reports about a file, which no rule can own: a `LintRule` reaches its subject through
 * `applicableNodeTypes`, so a claim about the header or a heading outside the tree escapes `RuleMeta.emits`. They take
 * an emitted rule's shape, cite included, rather than a prose cite and a parallel roster of exempt names in a test.
 * `emitsGrounding.test.ts` checks these cites beside the registry's own arms.
 */

import { groundedArm, type RuleArm } from './ruleArms.js';

export const FILE_DIAGNOSTICS = {
  /**
   * A header older than the text format Godot writes today. The only one with no engine line to cite (ADR-0032): the
   * loader's three header-version comparisons are all `>`, so 4.6.3 parses a `format=2` file with the current grammar.
   * Declining it is a decision about this tool's scope.
   */
  legacyFormat: groundedArm('legacy-format-version', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'the engine reads the file; the rules are written against the format it writes today',
  }),
  /**
   * A `parent=` path that resolves against nothing. Godot warns, re-parents the
   * node to the scene root and renames it `<path>#<name>`, so the file loads
   * and the node exists, in the wrong place under a different name.
   */
  unresolvedParentPath: {
    severity: 'warning',
    ruleName: 'unresolved-parent-path',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:208-215' },
  },
  /**
   * `parent=""`, which the text loader cannot read: it calls `prepend_period()` on the NodePath unconditionally
   * (`resource_format_text.cpp:206-207`), which dereferences `data` with no null check (`node_path.cpp:43-44`), and
   * `NodePath("")` leaves `data` unset (`:394-397`). The load faults before any node is made, so this is an error and
   * outranks the vanished-path warning.
   */
  emptyParentPath: {
    severity: 'error',
    ruleName: 'empty-parent-path',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:206-207' },
  },
  /**
   * A heading declaring no `parent=` while not being the root. The loader stores it (`resource_format_text.cpp:273`)
   * and the instantiate refuses, so the resource loads and no scene builds from it. `parent=""` is `emptyParentPath`
   * instead: the loader calls `add_node_path` for any value, which never returns `-1` (`packed_scene.cpp:2307-2311`).
   */
  nodeWithoutParent: {
    severity: 'error',
    ruleName: 'node-without-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:206-207' },
  },
  /**
   * The mirror of the above, on the one heading the rule is inverted for: the
   * root may not declare a `parent=`, and any value refuses the instantiate.
   * `parent="."` reads as harmless and is not: it is the spelling a file
   * missing its root heading falls into, since every other heading declares one.
   */
  rootDeclaresParent: {
    severity: 'error',
    ruleName: 'root-declares-parent',
    grounding: { kind: 'engine', at: 'packed_scene.cpp:218-219' },
  },
  /**
   * A rule threw. Reported on the node it ran on, or on no line for the
   * cross-file rule, naming the rule and the error. Every other rule still
   * runs. Not an engine claim about the file: the rule's own findings are
   * missing.
   */
  ruleCrashed: groundedArm('rule-crashed', {
    kind: 'no-engine-counterpart',
    scope: 'linter-failure',
    because: 'a rule threw instead of reporting; the linter says which one rather than dropping the file',
  }),
  /**
   * A well-formed `SubResource("id")` / `ExtResource("id")` in a registered resource slot whose id the file never
   * declares. Not a slice's claim: the loader resolves it while tokenising the value, before any setter, so every slot
   * fails the same way (`danglingResources.ts`). The ext twin is `resource_format_text.cpp:138`.
   */
  danglingResourceReference: {
    severity: 'error',
    ruleName: 'dangling-resource-reference',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:113' },
  },
  /**
   * An `[ext_resource]` whose `.glb`/`.gltf` requires a glTF extension outside Godot's importer set, used where a failed
   * load fails the file's load (`usedExtResources.ts`), in a project whose readable `project.godot` enables no editor
   * plugin and declares no autoload, and whose listing holds no GDExtension, so nothing can add the extension. The
   * import refuses the file (`gltf_document.cpp:7197-7202`). The cited line raises `ERR_FILE_MISSING_DEPENDENCIES` at
   * the use, and the section's read returns it (`:533-536`, `:647-650`, `:776-779`, `:381-384`). The three glTF rows
   * read other files, so only a lint session reports them.
   */
  unimportableGltf: {
    severity: 'error',
    ruleName: 'gltf-required-extension-unsupported',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:150-154' },
  },
  /**
   * The same use in a project that enables an editor plugin, declares an autoload or holds a GDExtension, or whose
   * files the linter cannot read or list. Each can register a `GLTFDocumentExtension` (`gltf_document.cpp:6731-6732`),
   * whose extensions join the supported set at the cited line, so the refusal is likely but not certain: the engine's
   * own message asks "Are you missing a GLTFDocumentExtension plugin?" (`:7200`).
   */
  unimportableGltfUnlessPlugin: {
    severity: 'warning',
    ruleName: 'gltf-required-extension-maybe-unsupported',
    grounding: { kind: 'engine', at: 'gltf_document.cpp:6798-6804' },
  },
  /**
   * The same file, used only in node headings and node bodies, which the cited line skips. The scene loads. A node
   * that instances the file is missing (`packed_scene.cpp:309-311`), and a node property that names it is null. The
   * editor runs with `abort_on_missing_resources` off (`editor_node.cpp:8331`), so it reports a broken dependency
   * and offers to open the scene anyway (`:4747-4756`). Whatever the plugin probe answers, this is a warning.
   */
  unimportableGltfInNode: {
    severity: 'warning',
    ruleName: 'gltf-required-extension-unsupported-in-node',
    grounding: { kind: 'engine', at: 'resource_format_text.cpp:288-289' },
  },
} as const satisfies Record<string, RuleArm>;

/**
 * `strict-parser`, the name Phase 1 stamps on every validator's `ParseError`.
 *
 * Not a row above: its severity and message come from the validator that
 * produced the error, and its authority is that validator's own `grounding`.
 */
export const STRICT_PARSER_RULE_NAME = 'strict-parser';

/** Every `ruleName` `Linter` stamps that no registered rule declares. */
export const FILE_DIAGNOSTIC_NAMES: ReadonlySet<string> = new Set([
  STRICT_PARSER_RULE_NAME,
  ...Object.values(FILE_DIAGNOSTICS).map((d) => d.ruleName),
]);

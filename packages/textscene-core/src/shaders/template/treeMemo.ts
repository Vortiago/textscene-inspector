/**
 * The memo of linked template stages: one user text parses into a template once, however many
 * materials use it. The key holds what Godot's shader cache keys on (`shader_rd.cpp:422`): the
 * text, the define set and the version, so an upgrade never serves a stale tree.
 */

import type { StageName } from './stages.js';
import type { TemplateStageNode } from './templateTree.js';

/**
 * The version of the transpiler's trees. Raise it with each change that gives a text a different
 * tree, so a memo kept past a page load never serves a tree of an older transpiler.
 */
export const TRANSPILER_VERSION = 1;

/** Everything a linked stage's tree depends on. */
export interface TreeKey {
  /** The user's shader text. */
  readonly source: string;
  /** The file that names the text in the position of each node. */
  readonly file: string;
  readonly shaderType: string;
  /** The template file, by its path under Godot's `shaders/` directory. */
  readonly template: string;
  readonly stage: StageName;
  /** The variant's define text, `SKY_VERSION_BACKGROUND` writes none. */
  readonly defines: string;
  readonly godotVersion: string;
  readonly transpilerVersion: number;
}

/** The linked stages by their key. A tree is immutable, so every caller shares it. */
export class TreeMemo {
  readonly #trees = new Map<string, TemplateStageNode>();

  /** The tree of `key`, built by `build` the first time the memo sees the key. */
  tree(key: TreeKey, build: () => TemplateStageNode): TemplateStageNode {
    const text = keyText(key);
    let tree = this.#trees.get(text);
    if (!tree) {
      tree = build();
      this.#trees.set(text, tree);
    }
    return tree;
  }
}

/** The key's fields in one fixed order, so two equal keys give one text. */
function keyText(key: TreeKey): string {
  return JSON.stringify([
    key.source,
    key.file,
    key.shaderType,
    key.template,
    key.stage,
    key.defines,
    key.godotVersion,
    key.transpilerVersion,
  ]);
}

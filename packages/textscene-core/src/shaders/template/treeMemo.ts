import type { StageName } from './stages.js';
import type { TemplateStageNode } from './templateTree.js';

/** Raise it with each change that gives a text another tree, so no stored tree outlives its transpiler. */
export const TRANSPILER_VERSION = 2;

/** Everything a linked stage's tree depends on. */
export interface TreeKey {
  /** The preprocessed shader text, with its includes and `CURRENT_RENDERER` in it. */
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

/** More than the skies a page draws at once, so an edit drops the oldest tree, not one in use. */
const KEPT_TREES = 64;

/** Least recently read dropped first. A tree is immutable, so every caller shares it. */
export class TreeMemo {
  readonly #trees = new Map<string, TemplateStageNode>();

  /** The tree of `key`, built by `build` the first time the memo sees the key. */
  tree(key: TreeKey, build: () => TemplateStageNode): TemplateStageNode {
    const text = keyText(key);
    const tree = this.#trees.get(text) ?? build();
    // A Map iterates in insertion order, so a read moves the key to the end.
    this.#trees.delete(text);
    this.#trees.set(text, tree);
    if (this.#trees.size > KEPT_TREES) this.#trees.delete(this.#trees.keys().next().value!);
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

/**
 * The cases of the template check: each stage of each template of Godot's renderer, under each
 * define set that takes a branch no other set takes. A case holds Godot's text of the variant and
 * the transpiler's printed tree of it, or the transpiler's refusal.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { glslFiles, WAITS_FOR_FSR } from '../../../../scripts/godot-templates/run.mjs';
import { coveringSets, isMaterialName, testedNames, variantText } from './defineSets.mjs';
import { definedNames, GENERAL_DEFINES } from './generalDefines.mjs';

/** Where the templates are in Godot's tree. */
export const TEMPLATE_DIR = 'servers/rendering/renderer_rd/shaders';

/**
 * The templates of Godot's source at `godotDir`: each file with stages, the files that only
 * stages include, and the files that wait for the third-party code.
 */
export function templateFiles(godotDir, { splitStages }) {
  const dir = join(godotDir, TEMPLATE_DIR);
  const read = (path) => {
    try {
      return readFileSync(join(dir, path), 'utf8');
    } catch {
      return undefined; // splitStages names a missing include itself.
    }
  };
  const templates = [];
  const includes = [];
  const waiting = [];
  for (const file of glslFiles(dir)) {
    if (WAITS_FOR_FSR.test(file)) waiting.push(file);
    else {
      const stages = splitStages(file, read);
      if (Object.keys(stages).length === 0) includes.push(file);
      else templates.push({ file, stages });
    }
  }
  return { templates, includes, waiting };
}

/** The variants of one stage of a template, each made from the names its define set holds. */
export class StageVariants {
  constructor(file, stage, lines, modules) {
    Object.assign(this, { file, stage, lines, modules });
    this.general = GENERAL_DEFINES[file] ?? '';
    this.names = testedNames(lines, definedNames(this.general));
    /** The branches each set takes, by the set's names. Written only by `takenBranches`. */
    this.taken = new Map();
  }

  get key() {
    return `${this.file} ${this.stage}`;
  }

  /** The cases of the sets that between them take each branch the preprocessor can take. */
  coveringCases() {
    return coveringSets(this.names, (set) => this.takenBranches(set)).map((set) => this.caseOf(set));
  }

  /** The cases of `set` and one more name, for each that takes branch `key`. */
  widenedCases(set, key) {
    return this.names
      .filter((name) => !set.includes(name) && this.takenBranches([...set, name].sort())?.includes(key))
      .map((name) => this.caseOf([...set, name].sort()));
  }

  /** The keys of the branches a variant with `set` takes, or nothing when the preprocessor refuses it. */
  takenBranches(set) {
    const id = set.join(' ');
    if (!this.taken.has(id)) this.taken.set(id, this.branchesOf(set));
    return this.taken.get(id);
  }

  branchesOf(set) {
    try {
      return this.modules
        .preprocess(this.variantOf(set))
        .branches.filter((branch) => branch.isTaken)
        .map((branch) => `${branch.file}:${branch.line}`);
    } catch {
      return undefined; // A variant the preprocessor refuses takes no branch, so no case is made of it.
    }
  }

  /** Godot's text of the variant of `set`, and the transpiler's printed tree of it or its refusal. */
  caseOf(set) {
    const { preprocess, parseTemplateStage, printTemplateStage } = this.modules;
    const variant = this.variantOf(set);
    const original = variant.map((line) => (line.slot ? '' : line.text)).join('\n');
    const entry = { stages: this, set, original, branches: new Set(this.takenBranches(set)) };
    try {
      return { ...entry, printed: printTemplateStage(parseTemplateStage(this.stage, preprocess(variant))) };
    } catch (error) {
      return { ...entry, refusal: error.message };
    }
  }

  variantOf(set) {
    const defines = {
      general: this.general,
      variant: variantText(set),
      custom: [],
      hasUniforms: false,
      codeSections: [],
    };
    return this.modules.variantLines(this.lines, defines);
  }

  /**
   * Every branch of the stage by `file:line`. A branch whose directive tests what a material
   * holds is left out: the link step's tests take it.
   */
  allBranches() {
    const keys = new Set();
    for (const line of this.variantOf([])) {
      if (line.slot || !/^\s*#\s*(if|ifdef|ifndef|elif|else)\b/.test(line.text)) continue;
      if ((line.text.match(/\w+/g) ?? []).some(isMaterialName)) continue;
      keys.add(`${line.file}:${line.line}`);
    }
    return keys;
  }
}

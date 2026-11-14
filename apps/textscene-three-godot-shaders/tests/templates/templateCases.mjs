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

/** Whether a branch is Godot's disabled code: `#if 0`, or the `#elif` or `#else` of `#if 1`. */
const isGodotDisabled = (text, head) =>
  /^\s*#\s*if\s+0\s*$/.test(text) ||
  (/^\s*#\s*(elif|else)\b/.test(text) && /^\s*#\s*if\s+1\s*$/.test(head ?? ''));

/** The variants of one stage of a template, each made from the names its define set holds. */
export class StageVariants {
  constructor(file, stage, lines, modules) {
    Object.assign(this, { file, stage, lines, modules });
    this.general = GENERAL_DEFINES[file] ?? '';
    this.names = testedNames(lines, definedNames(this.general));
    /** The branches the preprocessor decides for each set, by the set's names. Written only by `decidedBranches`. */
    this.decided = new Map();
  }

  get key() {
    return `${this.file} ${this.stage}`;
  }

  /** The cases of the sets that between them take each branch the preprocessor can take. */
  coveringCases() {
    return coveringSets(this.names, (set) => this.takenBranches(set)).map((set) => this.caseOf(set));
  }

  /**
   * The sets wider than `set` that take branch `key`: `set` with each name more, and `set` with
   * every name the branch's directive tests, for a condition of several names.
   */
  widenedSets(set, key) {
    const wider = (names) => [...new Set([...set, ...names])].sort();
    const candidates = [
      wider(this.directiveNames(key)),
      ...this.names.filter((name) => !set.includes(name)).map((name) => wider([name])),
    ];
    return candidates.filter(
      (candidate) => candidate.length > set.length && this.takenBranches(candidate)?.includes(key)
    );
  }

  /** The keys of the branches a variant with `set` takes, or nothing when the preprocessor refuses it. */
  takenBranches(set) {
    return this.decidedBranches(set)
      ?.filter((branch) => branch.isTaken)
      .map((branch) => branch.key);
  }

  /** Whether the preprocessor decides branch `key` for `set`, taken or not. */
  decides(set, key) {
    return this.decidedBranches(set)?.some((branch) => branch.key === key) ?? false;
  }

  decidedBranches(set) {
    const id = set.join(' ');
    if (!this.decided.has(id)) this.decided.set(id, this.branchesOf(set));
    return this.decided.get(id);
  }

  branchesOf(set) {
    try {
      return this.modules
        .preprocess(this.variantOf(set))
        .branches.map((branch) => ({ key: `${branch.file}:${branch.line}`, isTaken: branch.isTaken }));
    } catch {
      return undefined; // A variant the preprocessor refuses decides no branch, so no case is made of it.
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
   * Every branch the preprocessor decides for some set tried, by `file:line`. A branch in a comment
   * or in a branch no set reads is decided for none. A branch whose directive tests what a material
   * holds is left out, as the link step's tests take it, and so is Godot's disabled code.
   */
  allBranches() {
    const keys = new Set();
    for (const branches of this.decided.values())
      for (const { key } of branches ?? []) if (!this.isLeftOut(key)) keys.add(key);
    return keys;
  }

  isLeftOut(key) {
    const text = this.directiveText(key);
    return (
      (text.match(/\w+/g) ?? []).some(isMaterialName) || isGodotDisabled(text, this.chainHeads().get(key))
    );
  }

  /** The text of the `#if` that opens the chain of each branch, by the branch's key. */
  chainHeads() {
    if (this.heads) return this.heads;
    this.heads = new Map();
    const open = [];
    for (const line of this.variantOf([])) {
      const directive = /^\s*#\s*(\w+)/.exec(line.text)?.[1];
      if (/^if(n?def)?$/.test(directive)) open.push(line.text);
      if (/^(if(n?def)?|elif|else)$/.test(directive))
        this.heads.set(`${line.file}:${line.line}`, open.at(-1));
      if (directive === 'endif') open.pop();
    }
    return this.heads;
  }

  /** The tested names the directive of branch `key` holds. */
  directiveNames(key) {
    return (this.directiveText(key).match(/[A-Za-z_]\w*/g) ?? []).filter((name) => this.names.includes(name));
  }

  directiveText(key) {
    this.textByKey ??= new Map(this.variantOf([]).map((line) => [`${line.file}:${line.line}`, line.text]));
    return this.textByKey.get(key) ?? '';
  }
}

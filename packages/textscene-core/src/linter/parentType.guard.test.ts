/**
 * Who may hold a raw parent node. The unknowable-type test has three arms (an instanced
 * node, a typeless heading, an override inside an instance), and a copy that drops one
 * compiles and reads plausibly. So this guards the access, not the spelling: only
 * `parentType.ts` calls `findParentNode`, and its primitives gate `isTypeUnknowable`.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, linterDir, nodesRoot, srcLabel } from './testing/ruleNameScrape.js';

/**
 * The files that may name the raw parent accessor. `linterUtils.ts` declares
 * `findParentNode` and never calls it, which a test below checks. A rule that wants
 * the parent wants a verdict about it, or an ancestor chain that stops where the file
 * stops describing the tree.
 */
const PARENT_ACCESS_ALLOWED = new Set(['linter/linterUtils.ts', 'linter/parentType.ts']);

/**
 * The linter files that may read the raw `overridesExistingNode` flag. `StrictTscnParser.ts`
 * sets it for `parser/typeUnknowable.ts`, a parser file since `buildSceneTree` asks it and
 * cannot import the linter. `NodeRegistry.ts`, `graftInstanceChildren.ts` and
 * `glbNodeOverrides.ts` use it outside the linter for an unrelated question.
 */
const OVERRIDE_FLAG_ALLOWED = new Set(['linter/StrictTscnParser.ts']);

/**
 * The raw parent accessor, under any spelling of the call around it. A copy of the
 * test can be a ternary, a destructure, a bracketed read or no test at all, but each
 * needs a parent first, so this one line catches every re-spelling.
 */
const RAW_PARENT_ACCESS = /\bfindParentNode\b/;
/**
 * The same, counting occurrences. Derived, not re-spelled: the `linterUtils.ts`
 * assertion below is the positive control for both, and a separate literal could be
 * mutated to match nothing and stay green.
 */
const RAW_PARENT_ACCESS_ALL = new RegExp(RAW_PARENT_ACCESS.source, 'g');

/**
 * The files, minus the allowlist, whose code satisfies `predicate`. Source text, not
 * behaviour: the failure is a rule that never runs on a shape no fixture holds. Comments
 * are stripped, since a docblock explaining the rule is where the words appear.
 */
function offenders(
  predicate: (source: string) => boolean,
  allowed: Set<string>,
  files: string[] = allSourceFiles()
): string[] {
  return files
    .map((file) => ({ label: srcLabel(file), file }))
    .filter((entry) => !allowed.has(entry.label))
    .filter((entry) => predicate(stripComments(readFileSync(entry.file, 'utf8'))))
    .map((entry) => entry.label)
    .sort();
}

describe('only parentType.ts holds a raw parent', () => {
  it('walks the whole package, .tsx and non-linter subtrees included', () => {
    // Containment, not a size floor: a big walk can still miss the directory a
    // helper moves into. One known path per subtree, plus both allowlisted files,
    // so an exemption cannot name a file the walk never reaches.
    const scanned = allSourceFiles().map(srcLabel);
    for (const known of [
      'linter/parentType.ts',
      'linter/linterUtils.ts',
      'linter/StrictTscnParser.ts',
      'nodes/physics/2d/physicalbone2d/linter.ts',
      'parser/TscnParser.ts',
      'r3f/NodeDispatcher.tsx',
      'resources/mergeInstanceRoot.ts',
      'godot/math.ts',
    ]) {
      expect(scanned).toContain(known);
    }
    // Tests are not the population: they hold deliberate offenders as fixtures.
    expect(scanned).not.toContain('linter/parentType.test.ts');
  });

  it('reaches a node’s parent nowhere else', () => {
    expect(offenders((s) => RAW_PARENT_ACCESS.test(s), PARENT_ACCESS_ALLOWED)).toEqual([]);
  });

  it('lets linterUtils.ts declare the accessor without using it', () => {
    // A blanket exemption would let a second caller appear inside the file that
    // owns the definition. Comment-stripped like the sweeps: the two constants are
    // one spelling, so a count of prose would fail on a mention the sweeps ignore.
    const source = stripComments(readFileSync(resolve(linterDir, 'linterUtils.ts'), 'utf8'));
    expect(source.match(RAW_PARENT_ACCESS_ALL) ?? []).toHaveLength(1);
    expect(source).toContain('export function findParentNode(');
  });

  it('leaves `overridesExistingNode` to parentType.ts inside the linter', () => {
    // Reading the flag in a rule means a second copy of the unknowable test,
    // node-side this time, where no parent accessor is involved to catch it.
    const linterTree = allSourceFiles().filter(
      (file) => file.startsWith(linterDir) || file.startsWith(nodesRoot)
    );
    expect(offenders((s) => s.includes('overridesExistingNode'), OVERRIDE_FLAG_ALLOWED, linterTree)).toEqual([]);
  });

  it('stays quiet on the gated form, where the parent is past the check already', () => {
    // The other half of the sweep's correctness: over-breadth here would put
    // every rule that reads `verdict.parent.type` on the offenders list.
    expect(
      RAW_PARENT_ACCESS.test(
        "const verdict = parentTypeVerdict(scene, node, 'Area2D');\nif (verdict.kind === 'mismatch') report(verdict.parent.type);"
      )
    ).toBe(false);
  });
});

/**
 * Who may hold a raw parent node, and the guard that keeps it to one file.
 *
 * The unknowable-type test is three arms — an instanced node, a typeless
 * heading, an override of a node inside an instance — and a copy that drops one
 * is invisible: it compiles, it reads plausibly, and it only goes wrong on a
 * scene shape the corpus happens not to contain. A copy that drops ALL THREE is
 * worse still, because there is no re-spelling to recognise: `collisionPolygon`
 * and `collisionShape` simply asked `descendsFrom(parent.type, …)` and warned
 * about parents whose type is in another file.
 *
 * So this guards the ACCESS, not the spelling. `findParentNode` is the only way
 * to reach a node's parent, and only `parentType.ts` may call it; every other
 * file asks `parentType.ts`, whose primitives gate `isTypeUnknowable` before
 * they hand an ancestor back. The test itself lives in
 * `parser/typeUnknowable.ts`, since `buildSceneTree` asks it at every descent
 * of a `parent=` path and the parser cannot import the linter. A rule that cannot hold a raw parent cannot spell
 * the test wrongly, cannot spell it partially, and cannot omit it — the three
 * failures are one invariant.
 *
 * Source text rather than behaviour, deliberately: the failure is a rule that
 * never runs on a shape nobody wrote a fixture for, so there is nothing to
 * observe until someone writes one.
 *
 * That is also why the sweep reads only the ACCESSOR line and never the arm
 * beside it. `const unknowable = parent.instance ? true : !parent.type`, a
 * destructured `const { instance, type } = parent`, a bracketed
 * `parent['instance']`, and a `descendsFrom(parent.type, wanted)` with no test
 * at all are four plausible copies with four different shapes — and the last
 * has nothing to recognise. All of them need a parent first, so matching that
 * one line catches every re-spelling without enumerating any.
 *
 * Every sweep here reads comment-stripped source, like its sibling guards: prose
 * naming the accessor or the flag is not a use of either, and a docblock that
 * explains why a rule must not hold a raw parent is the likeliest place for the
 * words to appear.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, linterDir, nodesRoot, srcRoot } from './testing/ruleNameScrape.js';

/** A file's `src/`-relative path, the form every list below is written in. */
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/**
 * The files that may name the raw parent accessor.
 *
 * `linterUtils.ts` DECLARES `findParentNode` and never calls it, which the test
 * below checks rather than trusts; `parentType.ts` is its only caller, and
 * every primitive it exports applies `isTypeUnknowable` to an ancestor before
 * returning it. Nothing else has a reason: a rule that wants the parent wants a
 * verdict about it, and a rule that wants an ancestor chain wants one that
 * stops where the file stops describing the tree.
 */
const PARENT_ACCESS_ALLOWED = new Set(['linter/linterUtils.ts', 'linter/parentType.ts']);

/**
 * The files that may read the raw `overridesExistingNode` flag.
 *
 * `StrictTscnParser.ts` SETS it, and nothing in the linter reads it: the one
 * decision it feeds is `parser/typeUnknowable.ts`, which both trees ask
 * through. Scoped to the linter's own tree below, because the flag answers a
 * second, unrelated question outside it — `NodeRegistry.ts` sets it too, and
 * `graftInstanceChildren.ts` and `glbNodeOverrides.ts` read it to decide
 * whether an instanced child REPLACES one or is appended beside it, which has
 * nothing to do with whether a type is knowable.
 */
const OVERRIDE_FLAG_ALLOWED = new Set(['linter/StrictTscnParser.ts']);

/** The raw parent accessor, under any spelling of the call around it. */
const RAW_PARENT_ACCESS = /\bfindParentNode\b/;
/**
 * The same, counting occurrences rather than answering yes/no.
 *
 * DERIVED, not re-spelled. The `linterUtils.ts` assertion below is the only
 * place either constant meets real source text, so it is the positive control
 * for both — and it can only be that while the two cannot drift. A separately
 * written literal here would let the sweep's regex be mutated to match nothing
 * and stay green, which is the exact defect class this file exists to catch.
 */
const RAW_PARENT_ACCESS_ALL = new RegExp(RAW_PARENT_ACCESS.source, 'g');

/** The files, minus the allowlist, whose CODE satisfies `predicate`. */
function offenders(
  predicate: (source: string) => boolean,
  allowed: Set<string>,
  files: string[] = allSourceFiles()
): string[] {
  return files
    .map((file) => ({ label: label(file), file }))
    .filter((entry) => !allowed.has(entry.label))
    .filter((entry) => predicate(stripComments(readFileSync(entry.file, 'utf8'))))
    .map((entry) => entry.label)
    .sort();
}

describe('only parentType.ts holds a raw parent', () => {
  it('walks the whole package, .tsx and non-linter subtrees included', () => {
    // Containment, not a size floor: a floor proves the walk is big, and a walk
    // can be big while missing every directory a helper would be moved INTO.
    // One known path per subtree the earlier `[nodesRoot, linterDir]` pair
    // skipped, plus both allowlisted files, so an exemption cannot name a file
    // the walk never reaches.
    const scanned = allSourceFiles().map(label);
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
    // The weaker half of the allowlist, made checkable. A blanket exemption
    // would let a second caller appear inside the file that owns the
    // definition, which is the one place the invariant could rot unobserved.
    // Comment-stripped like the sweeps: the two constants are one spelling, so a
    // control that counted prose would red on a mention the sweeps ignore.
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

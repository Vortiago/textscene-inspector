/**
 * The linter half of a slice: the validator registration, the barrel entry that triggers it, and
 * the test that checks it against what the class binds. The indentation below is the emitted
 * file's, not this module's.
 */

export function linterFiles({ typeName, lower, chain, kebabName, base, toSrc, parentLinterImport }) {
  const files = new Map();
    files.set(
      'linterParser.ts',
      `/**
 * ${typeName} strict validators for linting.
 *
 * Declare only ${typeName}'s OWN members — the ones doc/classes/${typeName}.xml
 * lists without an \`overrides=\` attribute. Everything from ${chain} up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

${base.hasLinterParser ? `import '${parentLinterImport}';\n` : ''}import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';

validatorRegistry.registerAll('${typeName}', {});
`
    );
    files.set(
      'index.linter.ts',
      `/**
 * ${lower} linter registration - imports linter components to trigger self-registration.
 */

import './linterParser.js';
`
    );
    files.set(
      'linterParser.test.ts',
      `/**
 * ${typeName} strict validators — format and range checks.
 *
 * Asserted through \`validatorRegistry\` rather than by linting a \`.tscn\`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through \`Linter\`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry';
import { expectFixtureClean } from '${toSrc}linter/testing/fixtureCheck';
import { checkerFor } from '${toSrc}linter/testing/validatorCheck';
import './linterParser';

/**
 * \`${typeName}.<property>\`'s registered validator, invoked at line 1.
 *
 * Assert a rejection with \`expectError\` / \`expectWarning\` from the same module,
 * never with \`severity\` alone: the ADR-0032 tier is derived inside the validator
 * from its own \`enforced:\` / \`hinted:\` declaration, so a flipped one stays
 * self-consistent and every registry-wide guard agrees with it. Both helpers
 * require a substring of the message, which is where the bound's own number and
 * wording live — the second file the tier claim needs.
 */
const check = checkerFor('${typeName}');

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * ${typeName} binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ${typeName} does NOT declare, each paired with the ancestor that does.
 * Name at least one; ${chain} is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates \`getOwnKeys\`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives ${typeName} no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [];

describe('${typeName} strict validators', () => {
  it('registers exactly what ${typeName} binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('${typeName}').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. \`fixtureLint\` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    //
    // With no own keys that is the INHERITED validators only — \`linterParser\`
    // imports the parent chain — so it covers what ${chain} up declares and
    // becomes this slice's own claim the moment KEYS gains an entry.
    expectFixtureClean('unit-${kebabName}.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // ${typeName} declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('${typeName}')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key ${typeName} inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, \`\${owner} does not declare '\${key}'\`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // ${typeName} would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('${typeName}', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('${typeName}')).not.toContain(key);
    }
  });
});
`
    );
  return files;
}

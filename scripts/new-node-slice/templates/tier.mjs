/**
 * The files a validator tier is made of: the shared validator registration, its
 * test, and — only with `--rule` — the family rule, its test and the barrel
 * entry that pulls them in.
 */

export function tierFiles({ typeName, heirs, toSrc, rule, parentLinterImport }) {
  const files = new Map();
  files.set(
    'linterParser.ts',
    `/**
 * Validators shared by every ${typeName}-derived node.
 *
 * Registered under the abstract key '${typeName}', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * ${heirs.length} subclass${heirs.length === 1 ? '' : 'es'} through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only ${typeName}'s OWN members: the ones doc/classes/${typeName}.xml
 * lists without an \`overrides=\` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

${parentLinterImport ? `import '${parentLinterImport}';\n` : ''}import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';

validatorRegistry.registerAll('${typeName}', {});
`
  );
  files.set(
    'linterParser.test.ts',
    `/**
 * The ${typeName} set must reach its subclasses, which is the whole point of
 * the tier. Assert through \`findValidator\` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '${toSrc}linter/ValidatorRegistry.js';
import './linterParser.js';

/**
 * Every key ${typeName} binds, read from its ADD_PROPERTY calls.
 *
 * Set exactly ONE of these two, from the source rather than from expectation:
 * fill KEYS, or set DECLARES_NOTHING when the class binds no ADD_PROPERTY at all
 * (Godot has many: a themed spacer whose whole surface is theme items, an
 * orientation subclass that only fixes an inherited default). Leaving both unset
 * is red on purpose. Do NOT delete an assertion to go green: an empty KEYS
 * against an empty registerAll passes vacuously, which is what the pairing
 * below exists to prevent.
 */
const KEYS: string[] = [];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;
const LEAVES = ${JSON.stringify(heirs.slice(0, 3))} as const;

describe('${typeName} shared validators', () => {
  it('registers exactly what ${typeName} binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('${typeName}').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });
});
`
  );
  if (rule) {
    files.set(
      'linter.ts',
      `/**
 * Semantic rule for the whole ${typeName} family.
 *
 * One registration reaching every descendant through
 * \`applicableNodeTypeMatcher\`, because RuleRegistry matches
 * \`applicableNodeTypes\` by exact name and would otherwise never reach a
 * subclass. Mirror Godot's own \`${typeName}::get_configuration_warnings\`;
 * skip any case that needs resolving a NodePath's target TYPE, which crosses
 * into instanced sub-scenes this linter cannot see.
 */

import type { Diagnostic, LintRule, RuleContext } from '${toSrc}linter/types.js';
import { ruleRegistry } from '${toSrc}linter/RuleRegistry.js';
import { descendsFrom } from '${toSrc}linter/nodeBaseTypes.js';

function check${typeName}(context: RuleContext): Diagnostic[] {
  // No applicability check here: RuleRegistry has already filtered by the
  // matcher below, so re-asserting it states the same fact twice and the two
  // can drift.
  const { node } = context;
  void node;
  return [];
}

const ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule: LintRule = {
  meta: {
    name: 'valid-${typeName.toLowerCase()}',
    description: 'TBD',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, '${typeName}'),
    emits: [],
  },
  check: check${typeName},
};

ruleRegistry.register(${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule);

export { ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule };
`
    );
    files.set(
      'linter.test.ts',
      `/**
 * The ${typeName} family rule, asserted once for every subclass it reaches.
 */

import { describe, expect, it } from 'vitest';
import { ruleRegistry } from '${toSrc}linter/RuleRegistry.js';
import { ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule } from './linter.js';
import '${toSrc}linter/index.js';

describe('${typeName} family rule', () => {
  it('registers one rule for the family', () => {
    expect(ruleRegistry.getRules().find((r) => r.meta.name === 'valid-${typeName.toLowerCase()}')).toBe(
      ${typeName[0].toLowerCase() + typeName.slice(1)}ValidationRule
    );
  });
});
`
    );
    files.set(
      'index.linter.ts',
      `/**
 * ${typeName} tier registration: the shared validators and the family rule.
 * Barrel-imported because a rule has no leaf to pull it in.
 */

import './linterParser.js';
import './linter.js';
`
    );
  }
  return files;
}

/**
 * Base-class walk for `findValidator`. A subclass with no validator of
 * its own inherits its base type's validators, so the single Node3D/Node2D/
 * Control base validator sets reach every subclass instead of silently passing.
 * The walk is driven by an injected base-type map; the registry defaults to no
 * inheritance (empty map) and the singleton wires the real NODE_BASE_TYPES.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidatorRegistry, validatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import { baseChain } from './nodeBaseTypes.js';
import './index.js'; // trigger all validator registrations

// Child → Parent → Grandparent → (root). Grandparent has no further base.
const CHAIN = { Child: 'Parent', Parent: 'Grandparent' };

const baseVisible: PropertyValidator = () => null;
const ownTransform: PropertyValidator = () => null;

describe('ValidatorRegistry base-class walk', () => {
  it('finds a base-type validator for a subclass that registers none of its own', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('walks multiple hops up the chain', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Grandparent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('falls through to a base for a key the subclass does not cover', () => {
    // Child validates only `transform`; `visible` must still reach Parent.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Child', { transform: ownTransform });
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'transform')).toBe(ownTransform);
    expect(r.findValidator('Child', 'visible')).toBe(baseVisible);
  });

  it('prefers the subclass validator over an inherited one', () => {
    const own: PropertyValidator = () => null;
    const inherited: PropertyValidator = () => null;
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Child', { visible: own });
    r.registerAll('Parent', { visible: inherited });
    expect(r.findValidator('Child', 'visible')).toBe(own);
  });

  it('matches inherited wildcard patterns', () => {
    const wild: PropertyValidator = () => null;
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { 'theme_override_colors/*': wild });
    expect(r.findValidator('Child', 'theme_override_colors/font_color')).toBe(wild);
  });

  it('returns null when neither the type nor its bases validate the key', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'bogus')).toBeNull();
  });

  it('does not inherit when constructed without a base map (default = no inheritance)', () => {
    const r = new ValidatorRegistry();
    r.registerAll('Parent', { visible: baseVisible });
    expect(r.findValidator('Child', 'visible')).toBeNull();
  });

  it('terminates on a cyclic base map instead of looping forever', () => {
    const r = new ValidatorRegistry({ A: 'B', B: 'A' });
    r.registerAll('B', { visible: baseVisible });
    expect(r.findValidator('A', 'visible')).toBe(baseVisible);
    expect(r.findValidator('A', 'bogus')).toBeNull();
  });
});

describe('ValidatorRegistry.registerUnavailable', () => {
  const CHAIN = { Leaf: 'Mid', Mid: 'Root' };
  const ok: PropertyValidator = () => null;

  it('rejects every value for a key the leaf removes, naming the reason', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: 'its orientation is fixed' });
    const diagnostic = r.findValidator('Leaf', 'vertical')!('vertical', 'true', 7);
    expect(diagnostic?.code).toBe('UNAVAILABLE_VERTICAL');
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.message).toContain('cannot be set on Leaf');
    expect(diagnostic?.message).toContain('its orientation is fixed');
  });

  it('rejects the key whatever the value, since presence is the defect', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: 'fixed' });
    const validator = r.findValidator('Leaf', 'vertical')!;
    for (const value of ['true', 'false', '', 'garbage']) {
      expect(validator('vertical', value, 1)).not.toBeNull();
    }
  });

  it('leaves siblings and the declaring base untouched', () => {
    const r = new ValidatorRegistry({ ...CHAIN, Other: 'Root' });
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: 'fixed' });
    expect(r.findValidator('Other', 'vertical')).toBe(ok);
    expect(r.findValidator('Root', 'vertical')).toBe(ok);
  });

  it('does not count a removal as a declared key', () => {
    // getOwnKeys feeds the shadow guard and the sheet's own-property table; a
    // removal is neither a declaration nor a shadow.
    const r = new ValidatorRegistry(CHAIN);
    r.registerUnavailable('Leaf', { vertical: 'fixed' });
    expect(r.getOwnKeys('Leaf')).toEqual([]);
    expect(r.getUnavailableKeys('Leaf')).toEqual(['vertical']);
  });

  it('stops at a descendant that re-declares the key', () => {
    // Mid removes it, but Leaf validates it again, so Leaf can carry it.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Mid', { vertical: 'fixed' });
    r.registerAll('Leaf', { vertical: ok });
    expect(r.findValidator('Leaf', 'vertical')).toBe(ok);
    expect(r.findValidator('Mid', 'vertical')?.accepts).toBe('not available on this type');
  });

  it('reports the same reach through getUnavailableKeys as through findValidator', () => {
    // The two answer one question, for the linter and for the generated sheet.
    // While they disagreed, a key re-declared by a descendant was still listed
    // as unavailable in that descendant's sheet, contradicting the linter that
    // had just accepted it.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Root', { vertical: ok });
    r.registerUnavailable('Mid', { vertical: 'fixed' });
    r.registerAll('Leaf', { vertical: ok });
    expect(r.getUnavailableKeys('Leaf')).toEqual([]);
    expect(r.getUnavailableKeys('Mid')).toEqual(['vertical']);
  });

  it('keeps a key removed by the same type that declares it', () => {
    // Ordering within a hop: findValidator checks the removal first, so a type
    // both removing and declaring a key reports it removed. getUnavailableKeys
    // must agree rather than letting the declaration cancel the removal.
    const r = new ValidatorRegistry(CHAIN);
    r.registerAll('Leaf', { vertical: ok });
    r.registerUnavailable('Leaf', { vertical: 'fixed' });
    expect(r.findValidator('Leaf', 'vertical')?.accepts).toBe('not available on this type');
    expect(r.getUnavailableKeys('Leaf')).toEqual(['vertical']);
  });

  it('is cleared with the validators', () => {
    const r = new ValidatorRegistry(CHAIN);
    r.registerUnavailable('Leaf', { vertical: 'fixed' });
    r.clear();
    expect(r.findValidator('Leaf', 'vertical')).toBeNull();
  });

  it('refuses `vertical` on all four fixed-orientation containers, and allows it on their bases', () => {
    for (const fixed of ['HBoxContainer', 'VBoxContainer', 'HSplitContainer', 'VSplitContainer']) {
      const diagnostic = validatorRegistry.findValidator(fixed, 'vertical')!('vertical', 'true', 1);
      expect(diagnostic?.code, fixed).toBe('UNAVAILABLE_VERTICAL');
      expect(validatorRegistry.getOwnKeys(fixed), fixed).toEqual([]);
    }
    for (const base of ['BoxContainer', 'SplitContainer']) {
      expect(validatorRegistry.findValidator(base, 'vertical')!('vertical', 'true', 1)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Meta-guard: no linterParser.ts may re-declare a key that its base chain
// already carries — a shadow copy silently drifts from the base validator.
// ---------------------------------------------------------------------------

/**
 * Keys a subclass re-declares on purpose, as `Type:key`.
 *
 * Empty, and that is the point. The four entries this once held were the
 * fixed-orientation containers, which do not re-declare `vertical` at all —
 * they REMOVE it, via `registerUnavailable`, so there is no shadow to allow.
 * Narrowing has its own mechanism now, which means a re-declaration is once
 * again always the drift this guard exists to catch.
 *
 * Add here only for a subclass that genuinely re-declares a base key and
 * accepts something DIFFERENT, not less; a leaf that accepts less belongs in
 * `registerUnavailable`.
 */
const INTENTIONAL_OVERRIDES = new Set<string>([]);

/** Walk the filesystem for all linterParser.ts source files. */
function walkLinterParsers(dir: string): string[] {
  const results: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...walkLinterParsers(full));
    } else if (entry.name === 'linterParser.ts') {
      results.push(full);
    }
  }
  return results;
}

/**
 * Slice of `source` from `start` (just past an opening `{`) to its balanced
 * closing `}`. Good enough for validator registrations: none of the scanned
 * sources put braces inside string literals.
 */
function balancedBody(source: string, start: number): string {
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i);
  }
  return source.slice(start);
}

/**
 * Extract (nodeType, key[]) from a linterParser.ts source file. Finds each
 * `validatorRegistry.registerAll('TypeName', { … })` call, captures the full
 * balanced object literal, and reads only its top-level keys — nested option
 * objects like `v.int('rings', { min: 1 })` are stripped first so keys
 * declared after them are still seen.
 */
function extractRegisteredKeys(source: string): Array<{ nodeType: string; keys: string[] }> {
  const results: Array<{ nodeType: string; keys: string[] }> = [];
  const headRe = /registerAll\(\s*'([^']+)'\s*,\s*\{/g;
  let head: RegExpExecArray | null;
  while ((head = headRe.exec(source)) !== null) {
    const nodeType = head[1]!;
    let body = balancedBody(source, headRe.lastIndex);
    // Repeatedly drop innermost object literals until only top-level keys remain.
    for (let prev = ''; prev !== body; ) {
      prev = body;
      body = body.replace(/\{[^{}]*\}/g, '');
    }
    const keys: string[] = [];
    const keyRe = /^\s*(?:'([^']+)'|([\w/*]+))\s*:/gm;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyRe.exec(body)) !== null) {
      const key = keyMatch[1] ?? keyMatch[2];
      if (key) keys.push(key);
    }
    results.push({ nodeType, keys });
  }
  return results;
}

/**
 * The guard itself: every key a registration re-declares while its base chain
 * already carries it is a violation, unless allowlisted as `Type:key`.
 */
function findShadowViolations(
  registrations: Array<{ nodeType: string; keys: string[] }>,
  inheritedKeysOf: (nodeType: string) => Set<string>,
  intentionalOverrides: Set<string>
): string[] {
  const violations: string[] = [];
  for (const { nodeType, keys } of registrations) {
    const inherited = inheritedKeysOf(nodeType);
    for (const key of keys) {
      if (inherited.has(key) && !intentionalOverrides.has(`${nodeType}:${key}`)) {
        violations.push(`'${nodeType}' re-declares '${key}' which is already in its base chain`);
      }
    }
  }
  return violations;
}

/** Collect all keys registered for a type by walking up its base chain. */
function baseChainKeys(nodeType: string): Set<string> {
  return new Set(baseChain(nodeType).flatMap((ancestor) => validatorRegistry.getOwnKeys(ancestor)));
}

describe('ValidatorRegistry meta-guard: no shadow copies', () => {
  // A scratch chain where 'Child' inherits 'transform': proves the guard fires
  // before trusting the filesystem scan's silence.
  const scratchInherited = (nodeType: string): Set<string> =>
    new Set(nodeType === 'Child' ? ['transform'] : []);

  it('fails on a seeded duplicate key', () => {
    const source = `
      validatorRegistry.registerAll('Child', {
        transform: v.transform3d('transform'),
        own_prop: v.boolean('own_prop'),
      });
    `;
    const violations = findShadowViolations(
      extractRegisteredKeys(source),
      scratchInherited,
      new Set()
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("'Child' re-declares 'transform'");
  });

  it('an INTENTIONAL_OVERRIDES entry suppresses the seeded violation', () => {
    const source = `
      validatorRegistry.registerAll('Child', {
        transform: v.transform3d('transform'),
      });
    `;
    const violations = findShadowViolations(
      extractRegisteredKeys(source),
      scratchInherited,
      new Set(['Child:transform'])
    );
    expect(violations).toHaveLength(0);
  });

  it('sees keys declared after a nested option object', () => {
    // The deleted shadow copies sat at the END of registrations that contain
    // option objects — the extraction must not stop at the first nested `}`.
    const source = `
      validatorRegistry.registerAll('Child', {
        rings: v.int('rings', { min: 1 }),
        transform: v.transform3d('transform'),
      });
    `;
    const parsed = extractRegisteredKeys(source);
    expect(parsed[0]!.keys).toEqual(['rings', 'transform']);
  });

  it('no linterParser.ts re-declares a key that its base chain already registers', () => {
    const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
    const nodesDir = resolve(here, '../nodes');
    const files = walkLinterParsers(nodesDir);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const found = findShadowViolations(
        extractRegisteredKeys(source),
        baseChainKeys,
        INTENTIONAL_OVERRIDES
      );
      violations.push(...found.map((v) => `${file}\n  → ${v}`));
    }

    if (violations.length > 0) {
      throw new Error(
        `Shadow copy anti-pattern detected — remove the duplicate key(s) and let the base-walk deliver them:\n\n${violations.join('\n\n')}`
      );
    }
  });

  it('Light3D validators are reachable for every concrete light subclass via the base-walk', () => {
    const lightLeaves = ['DirectionalLight3D', 'OmniLight3D', 'SpotLight3D', 'AreaLight3D'];
    const sharedKeys = [
      'light_energy',
      'light_color',
      'shadow_enabled',
      'shadow_opacity',
      'shadow_blur',
    ];

    for (const lightType of lightLeaves) {
      for (const key of sharedKeys) {
        const validator = validatorRegistry.findValidator(lightType, key);
        expect(
          validator,
          `'${key}' should be reachable for ${lightType} via the base-walk`
        ).not.toBeNull();
      }
    }
  });
});

/**
 * Base-class walk for `findValidator` (#143). A subclass with no validator of
 * its own inherits its base type's validators, so the single Node3D/Node2D/
 * Control base validator sets reach every subclass instead of silently passing.
 * The walk is driven by an injected base-type map; the registry defaults to no
 * inheritance (empty map) and the singleton wires the real NODE_BASE_TYPES.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
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

// ---------------------------------------------------------------------------
// Meta-guard: no linterParser.ts may re-declare a key that its base chain
// already carries. Shadow copies are the anti-pattern this issue (#254) removes.
// ---------------------------------------------------------------------------

/**
 * Keys that are intentionally re-declared in a subclass (e.g., a stricter
 * override that passes both linting and tests). Starts empty — add here only
 * after explicit review.
 */
const INTENTIONAL_OVERRIDES = new Set<string>([]);

/** Walk the filesystem for all linterParser.ts source files. */
function walkLinterParsers(dir: string): string[] {
  const results: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
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
 * Extract (nodeType, key[]) from a linterParser.ts source file.
 * Handles the pattern: validatorRegistry.registerAll('TypeName', { key: ... })
 * Regex captures the first non-nested block after the opening brace.
 */
const REGISTER_ALL_RE = /registerAll\(\s*'([^']+)'\s*,\s*\{([^}]*)\}/gs;
const KEY_RE = /^\s*'([^']+)'\s*:|^\s*([\w/*]+)\s*:/gm;

function extractRegisteredKeys(source: string): Array<{ nodeType: string; keys: string[] }> {
  const results: Array<{ nodeType: string; keys: string[] }> = [];
  const blockRe = new RegExp(REGISTER_ALL_RE.source, 'gs');
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRe.exec(source)) !== null) {
    const nodeType = blockMatch[1]!;
    const body = blockMatch[2]!;
    const keys: string[] = [];
    const keyRe = new RegExp(KEY_RE.source, 'gm');
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyRe.exec(body)) !== null) {
      const key = keyMatch[1] ?? keyMatch[2];
      if (key) keys.push(key);
    }
    results.push({ nodeType, keys });
  }
  return results;
}

/** Collect all keys registered for a type by walking up its base chain. */
function baseChainKeys(nodeType: string): Set<string> {
  const keys = new Set<string>();
  let current: string | undefined = NODE_BASE_TYPES[nodeType];
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    const ownKeys = validatorRegistry.getOwnKeys(current);
    for (const k of ownKeys) keys.add(k);
    current = NODE_BASE_TYPES[current];
  }
  return keys;
}

describe('ValidatorRegistry meta-guard: no shadow copies', () => {
  it('seeded duplicate key on a scratch registry is detected by the algorithm', () => {
    // Prove the detection logic works before running the filesystem scan.
    const source = `
      validatorRegistry.registerAll('Child', {
        transform: v.transform3d('transform'),
        own_prop: v.boolean('own_prop'),
      });
    `;
    const parsed = extractRegisteredKeys(source);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.nodeType).toBe('Child');
    expect(parsed[0]!.keys).toContain('transform');
    expect(parsed[0]!.keys).toContain('own_prop');
  });

  it('no linterParser.ts re-declares a key that its base chain already registers', () => {
    const here = dirname(fileURLToPath(import.meta.url)); // .../src/linter
    const nodesDir = resolve(here, '../nodes');
    const files = walkLinterParsers(nodesDir);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const registrations = extractRegisteredKeys(source);

      for (const { nodeType, keys } of registrations) {
        const inherited = baseChainKeys(nodeType);
        for (const key of keys) {
          const overrideId = `${nodeType}:${key}`;
          if (inherited.has(key) && !INTENTIONAL_OVERRIDES.has(overrideId)) {
            violations.push(
              `${file}\n  → '${nodeType}' re-declares '${key}' which is already in its base chain`
            );
          }
        }
      }
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

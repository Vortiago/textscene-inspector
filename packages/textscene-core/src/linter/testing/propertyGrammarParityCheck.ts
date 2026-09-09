/**
 * The parity comparison itself: one inventory of the slices, and the asymmetries
 * left once the allowlist has had its say.
 *
 * Kept beside the guard rather than inside it because the inventory is a single
 * filesystem sweep several assertions share, and because the comparison is the
 * part worth reading on its own — the allowlist is consulted up the base chain,
 * so a base entry answers for every leaf below it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseChain } from '../../godot/nodeBaseTypes.js';
import { validatorRegistry } from '../ValidatorRegistry.js';
import { ASYMMETRY_ALLOWLIST } from '../propertyGrammarParityAllowlist.js';
import {
  extractNodeType,
  findSliceDirs,
  getInheritedParserProps,
  nodesRoot,
  scrapeParserReads,
} from './propertyGrammarParityScan.js';

/** Validator keys registered directly for a node type or any of its ancestors. */
export function getFullValidatorKeys(nodeType: string): Set<string> {
  const result = new Set(validatorRegistry.getOwnKeys(nodeType));
  for (const base of baseChain(nodeType)) {
    for (const k of validatorRegistry.getOwnKeys(base)) result.add(k);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Slice inventory: one walk + one scrape per slice, shared by all tests.
// ---------------------------------------------------------------------------

export interface SliceInfo {
  /** Slice directory relative to src/nodes. */
  slice: string;
  nodeType: string;
  /** Own scraped props, followed helpers included, + inherited base parser props. */
  parserProps: Set<string>;
  /** Own registered keys + inherited base validator keys. */
  validatorKeys: Set<string>;
}

let cachedSlices: SliceInfo[] | null = null;

export function collectSlices(): SliceInfo[] {
  if (cachedSlices) return cachedSlices;
  cachedSlices = [];
  for (const dir of findSliceDirs(nodesRoot).sort()) {
    const linterSrc = readFileSync(join(dir, 'linterParser.ts'), 'utf8');
    const nodeType = extractNodeType(linterSrc);
    if (!nodeType) continue; // shared-helper file — no registerAll

    cachedSlices.push({
      slice: dir.slice(nodesRoot.length + 1),
      nodeType,
      parserProps: new Set([
        ...scrapeParserReads(join(dir, 'parser.ts')),
        ...getInheritedParserProps(nodeType),
      ]),
      validatorKeys: getFullValidatorKeys(nodeType),
    });
  }
  return cachedSlices;
}

// ---------------------------------------------------------------------------
// Core guard logic
// ---------------------------------------------------------------------------

export interface ParityViolation {
  slice: string;
  nodeType: string;
  parserOnlyNotAllowlisted: string[];
  linterOnlyNotAllowlisted: string[];
}

export function checkParity(): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const { slice, nodeType, parserProps, validatorKeys } of collectSlices()) {
    // Collect allowlist entries from this type AND all ancestor types so a
    // base-type entry (e.g. Node3D.linterOnly) applies to every leaf slice.
    const allowedParserOnly = new Set<string>();
    const allowedLinterOnly = new Set<string>();
    for (const t of [nodeType, ...baseChain(nodeType)]) {
      const e = ASYMMETRY_ALLOWLIST[t];
      if (!e) continue;
      for (const k of e.parserOnly ?? []) allowedParserOnly.add(k);
      // Both suppress the failure; they differ in what they claim about WHY,
      // which is what a reader and the census below need.
      for (const k of e.linterOnly ?? []) allowedLinterOnly.add(k);
      for (const k of e.renderGap ?? []) allowedLinterOnly.add(k);
    }

    const parserOnlyNotAllowlisted = [...parserProps]
      .filter((k) => !validatorKeys.has(k) && !allowedParserOnly.has(k))
      .sort();
    const linterOnlyNotAllowlisted = [...validatorKeys]
      .filter((k) => !parserProps.has(k) && !allowedLinterOnly.has(k))
      .sort();

    if (parserOnlyNotAllowlisted.length > 0 || linterOnlyNotAllowlisted.length > 0) {
      violations.push({ slice, nodeType, parserOnlyNotAllowlisted, linterOnlyNotAllowlisted });
    }
  }

  return violations;
}

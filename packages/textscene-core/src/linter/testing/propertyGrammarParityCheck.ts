/**
 * The parity comparison: one inventory of the slices, and the asymmetries left
 * after the allowlist, which is read up the base chain so a base entry answers
 * for every leaf. The inventory is one filesystem sweep the assertions share.
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
    if (!nodeType) continue; // a shared-helper file, with no registerAll

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

export interface ParityViolation {
  slice: string;
  nodeType: string;
  parserOnlyNotAllowlisted: string[];
  linterOnlyNotAllowlisted: string[];
}

export function checkParity(): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const { slice, nodeType, parserProps, validatorKeys } of collectSlices()) {
    // A base-type entry, such as Node3D.linterOnly, applies to every leaf slice.
    const allowedParserOnly = new Set<string>();
    const allowedLinterOnly = new Set<string>();
    for (const t of [nodeType, ...baseChain(nodeType)]) {
      const e = ASYMMETRY_ALLOWLIST[t];
      if (!e) continue;
      for (const k of e.parserOnly ?? []) allowedParserOnly.add(k);
      // Both suppress the failure. They differ only in the reason they claim.
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

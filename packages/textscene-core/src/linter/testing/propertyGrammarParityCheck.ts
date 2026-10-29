/**
 * The parity comparison: one inventory of the slices, and the asymmetries left
 * after the allowlist, which is read up the base chain so a base entry answers
 * for every leaf. The inventory is one filesystem sweep the assertions share.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classInheritanceChain } from '../../godot/classdb/classBaseTypes.js';
import { NODE_CLASS_PROPERTIES } from '../../godot/classdb/classProperties.generated.js';
import { UNCATALOGUED_PROPERTIES } from '../../godot/classdb/uncataloguedProperties.js';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry.js';
// The registrations the previewer reads: `renderIntentOf` answers 'draws' for a type with none.
import '../../r3f/nodes/index.js';
import { validatorRegistry } from '../ValidatorRegistry.js';
import { ASYMMETRY_ALLOWLIST } from './propertyGrammarParityAllowlist.js';
import {
  extractNodeType,
  findParserFile,
  findSliceDirs,
  getInheritedParserProps,
  nodesRoot,
  scrapeParserReads,
} from './propertyGrammarParityScan.js';

/** Validator keys registered directly for a node type or any of its ancestors. */
export function getFullValidatorKeys(nodeType: string): Set<string> {
  const result = new Set<string>();
  for (const type of classInheritanceChain(nodeType)) {
    for (const k of validatorRegistry.getOwnKeys(type)) result.add(k);
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
  /** Whether the component registry declares the node's effect a gap (`renderIntent: 'pending'`). */
  isPending: boolean;
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
        ...scrapeParserReads(findParserFile(dir)!),
        ...getInheritedParserProps(nodeType),
      ]),
      validatorKeys: getFullValidatorKeys(nodeType),
      isPending: nodeComponentRegistry.renderIntentOf(nodeType) === 'pending',
    });
  }
  return cachedSlices;
}

/** Every property name Godot declares on `nodeType` and its ancestors, by type. */
const enginePropertyNames = new Map<string, ReadonlySet<string>>();

function enginePropertiesOf(nodeType: string): ReadonlySet<string> {
  let names = enginePropertyNames.get(nodeType);
  if (!names) {
    names = new Set(
      classInheritanceChain(nodeType).flatMap((type) =>
        [...(NODE_CLASS_PROPERTIES[type] ?? []), ...(UNCATALOGUED_PROPERTIES[type] ?? [])].map(
          ([name]) => name
        )
      )
    );
    enginePropertyNames.set(nodeType, names);
  }
  return names;
}

/**
 * Whether Godot declares `key` on `nodeType` or an ancestor. A wildcard or indexed key names a
 * family that the ClassDB rows do not list (Skeleton3D has no `bones` row), so it passes.
 */
export function isEngineProperty(nodeType: string, key: string): boolean {
  if (key.includes('*') || key.includes('#')) return true;
  return enginePropertiesOf(nodeType).has(key);
}

interface UnreadKeysInput {
  nodeType: string;
  validatorKeys: ReadonlySet<string>;
  parserProps: ReadonlySet<string>;
  /** The keys the allowlist excuses for this slice. */
  allowed: ReadonlySet<string>;
  isPending: boolean;
}

/**
 * The validator keys no parser reads and no allowlist entry excuses. A pending slice excuses each
 * key Godot declares, as a render gap, and still reports a key Godot does not declare: a typo.
 */
export function unreadValidatorKeys({
  nodeType,
  validatorKeys,
  parserProps,
  allowed,
  isPending,
}: UnreadKeysInput): string[] {
  return [...validatorKeys]
    .filter((key) => !parserProps.has(key) && !allowed.has(key))
    .filter((key) => !isPending || !isEngineProperty(nodeType, key))
    .sort();
}

export interface ParityViolation {
  slice: string;
  nodeType: string;
  parserOnlyNotAllowlisted: string[];
  linterOnlyNotAllowlisted: string[];
}

export function checkParity(): ParityViolation[] {
  const violations: ParityViolation[] = [];

  for (const { slice, nodeType, parserProps, validatorKeys, isPending } of collectSlices()) {
    // A base-type entry, such as Node3D.linterOnly, applies to every leaf slice.
    const allowedParserOnly = new Set<string>();
    const allowedLinterOnly = new Set<string>();
    for (const t of classInheritanceChain(nodeType)) {
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
    const linterOnlyNotAllowlisted = unreadValidatorKeys({
      nodeType,
      validatorKeys,
      parserProps,
      allowed: allowedLinterOnly,
      isPending,
    });

    if (parserOnlyNotAllowlisted.length > 0 || linterOnlyNotAllowlisted.length > 0) {
      violations.push({ slice, nodeType, parserOnlyNotAllowlisted, linterOnlyNotAllowlisted });
    }
  }

  return violations;
}

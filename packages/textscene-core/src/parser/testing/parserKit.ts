/**
 * Shared test kit for parser slice tests: the node `heading()` factory, the formatter
 * `valueOf()` lookup, the repo-root and fixture resolvers and the scene `flatten()`.
 * Build-excluded through the `src/**\/testing/**` tsconfig rule, like the linter test kit.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParsedHeading } from '../utils';
import type { TscnNode, TscnScene } from '../types';
import type { PropertySection } from '../../core/NodeRegistry';
import type { Node3DProperties, Transform3D } from '../../nodes/base/node3d/types';

/**
 * Build a `[node ...]` ParsedHeading for the given node type. `name` defaults
 * to the type; extra attributes (`name`, `parent`, `groups`, …) merge in and
 * may override it.
 */
export function heading(type: string, attributes: Record<string, string> = {}): ParsedHeading {
  return { type: 'node', attributes: { name: type, type, ...attributes } };
}

/**
 * Find the first item labelled `label` across a formatter's sections and
 * return its value, or undefined when no section carries it.
 */
export function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

/**
 * The monorepo root, found by walking up to pnpm-workspace.yaml, so it holds from the
 * repo root or the package dir. Never `process.cwd()` (AGENTS.md).
 */
export function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above parserKit');
}

/** Absolute path to the shared `scenes/fixtures` corpus at the repo root. */
export function fixturesDir(): string {
  return resolve(repoRoot(), 'scenes/fixtures');
}

/** Every node of a parsed scene, depth first, each parent before its children. */
export function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (node: TscnNode): void => {
    out.push(node);
    node.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

/**
 * A parsed node's `transform`, when present. `'transform' in properties` does not
 * narrow: the `Record<string, unknown>` arm keeps it `unknown`, which a truthy check
 * narrows only to `{}`.
 */
export function transformOf(
  properties: Node3DProperties | Record<string, unknown>
): Transform3D | undefined {
  return 'transform' in properties ? (properties as Node3DProperties).transform : undefined;
}

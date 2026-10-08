/**
 * Shared test kit for parser slice tests: the node `heading()`, `parsedNode()`, `makeNode()`
 * and `translated()` factories, the formatter `valueOf()` lookup, the repo-root and fixture
 * resolvers, the `sceneFiles()` corpus walk and the scene `flatten()`.
 * Build-excluded through the `src/**\/testing/**` tsconfig rule, like the linter test kit.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParsedHeading } from '../utils';
import type { TscnNode, TscnScene } from '../types';
import { parseNodeWithRegistry, type PropertySection } from '../../core/NodeRegistry';
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
 * A node as the scene parser builds it from its heading attributes and raw property
 * lines, so `properties` and `rawProperties` agree. The type's slice must be imported.
 */
export function parsedNode(attributes: Record<string, string>, raw: Record<string, string> = {}): TscnNode {
  const node = parseNodeWithRegistry({ type: 'node', attributes }, raw);
  if (!node) throw new Error(`expected a parsed node for ${JSON.stringify(attributes)}, got null`);
  return node;
}

/**
 * `parsedNode` of `name` and `type`, its `instance` and `rawProperties` parsed in, with the
 * other `fields` laid over the result.
 */
export function makeNode(name: string, type: string, fields: Partial<TscnNode> = {}): TscnNode {
  const { rawProperties, instance, ...rest } = fields;
  return { ...parsedNode({ name, type, ...(instance ? { instance } : {}) }, rawProperties), ...rest };
}

/**
 * The `Transform3D(...)` text Godot writes for an identity basis at this origin
 * (`variant_parser.cpp:2110-2126`).
 */
export function translated(x: number, y: number, z: number): string {
  return `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, ${y}, ${z})`;
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

/** Absolute path to the `scenes` corpus at the repo root. */
export function scenesDir(): string {
  return resolve(repoRoot(), 'scenes');
}

/** Absolute path to the shared `scenes/fixtures` corpus at the repo root. */
export function fixturesDir(): string {
  return resolve(scenesDir(), 'fixtures');
}

/** Every file under `dir` whose path `matches`, as absolute paths in sorted order. */
export function sceneFiles(dir: string, matches: (path: string) => boolean): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter(matches)
    .map((file) => join(dir, file))
    .sort();
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
export function transformOf(properties: Node3DProperties | Record<string, unknown>): Transform3D | undefined {
  return 'transform' in properties ? (properties as Node3DProperties).transform : undefined;
}

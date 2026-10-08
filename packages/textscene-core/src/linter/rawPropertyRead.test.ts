/**
 * Every lint rule reads a node's values through `rawProperties`, the raw literals both parsers publish. On the
 * lenient tree `properties` holds typed render values, so a rule or helper that read it would see other values
 * whenever the render path calls it. The strict tree's `properties` is withheld here, and the rule phase must not
 * notice.
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { StrictTscnParser } from './StrictTscnParser.js';
import { ruleRegistry } from './RuleRegistry.js';
import { danglingResourceDiagnostics } from './danglingResources.js';
import { isGodotTextResourcePath } from '../godot/index.js';
import type { TscnNode, TscnScene } from '../parser/types.js';
import './index.js';

const scenesRoot = resolve(import.meta.dirname, '../../../../scenes');

/** A `properties` bag whose every read throws, naming the key. */
const WITHHELD: TscnNode['properties'] = new Proxy(
  {},
  {
    get: (_target, key) => {
      throw new Error(`read properties.${String(key)}`);
    },
    ownKeys: () => {
      throw new Error('enumerated properties');
    },
  }
);

function withhold(nodes: readonly TscnNode[]): void {
  for (const node of nodes) {
    node.properties = WITHHELD;
    withhold(node.children);
  }
}

/** Each rule that read `properties` while linting `scene`, with the read it made. */
function propertiesReads(scene: TscnScene): string[] {
  const reads: string[] = [];
  const visit = (node: TscnNode): void => {
    for (const rule of ruleRegistry.getRulesForNodeType(node.type)) {
      try {
        rule.check({ scene, node });
      } catch (error) {
        reads.push(`${rule.meta.name} on ${node.name}: ${(error as Error).message}`);
      }
    }
    for (const child of node.children) visit(child);
  };
  for (const node of scene.nodes) visit(node);
  return reads;
}

function parsedWithheld(file: string) {
  const { scene, lines } = new StrictTscnParser().parse(readFileSync(file, 'utf8'));
  if (!scene) throw new Error(`expected a scene from ${file}, got none`);
  withhold(scene.nodes);
  return { scene, lines };
}

const corpus = readdirSync(scenesRoot, { recursive: true, encoding: 'utf8' })
  .filter(isGodotTextResourcePath)
  .map((file) => join(scenesRoot, file))
  .sort();

describe('the rule phase with properties withheld', () => {
  it('runs every rule over the scene corpus without reading properties', () => {
    const reads = corpus.flatMap((file) =>
      propertiesReads(parsedWithheld(file).scene).map((read) => `${relative(scenesRoot, file)}: ${read}`)
    );
    expect(reads).toEqual([]);
  });

  it('finds dangling resource references without reading properties', () => {
    const failures = corpus.flatMap((file) => {
      const { scene, lines } = parsedWithheld(file);
      try {
        danglingResourceDiagnostics(scene, lines);
        return [];
      } catch (error) {
        return [`${relative(scenesRoot, file)}: ${(error as Error).message}`];
      }
    });
    expect(failures).toEqual([]);
  });
});

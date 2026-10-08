/**
 * The rule phase over every `.tscn` and `.tres` under `scenes/`, with each node's `properties` withheld. A rule sees
 * the **Raw view**, which the compiler enforces. This catches what a cast hides, on the paths the corpus reaches.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { StrictTscnParser } from './StrictTscnParser.js';
import { ruleRegistry } from './RuleRegistry.js';
import { danglingResourceDiagnostics } from './danglingResources.js';
import { godotTextFiles, SCENES_ROOT } from './testing/sceneCorpus.js';
import type { TscnNode, TscnScene } from '../parser/types.js';
import './index.js';

/** Thrown by a withheld `properties` bag, so a rule's own crash is not counted as a read. */
class WithheldRead extends Error {}

function refuse(access: string): never {
  throw new WithheldRead(access);
}

/** A `properties` bag whose every read, key test or enumeration throws, naming the access. */
const WITHHELD: TscnNode['properties'] = new Proxy(
  {},
  {
    get: (_target, key) => refuse(`read properties.${String(key)}`),
    has: (_target, key) => refuse(`tested properties.${String(key)}`),
    getOwnPropertyDescriptor: (_target, key) => refuse(`read properties.${String(key)}`),
    ownKeys: () => refuse('enumerated properties'),
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
        if (!(error instanceof WithheldRead)) throw error;
        reads.push(`${rule.meta.name} on ${node.name}: ${error.message}`);
      }
    }
    for (const child of node.children) visit(child);
  };
  for (const node of scene.nodes) visit(node);
  return reads;
}

/** Parsed once for both tests: neither changes a tree. */
const corpus = godotTextFiles(SCENES_ROOT).map((file) => {
  const { scene, lines } = new StrictTscnParser().parse(readFileSync(file, 'utf8'));
  if (!scene) throw new Error(`expected a scene from ${file}, got none`);
  withhold(scene.nodes);
  return { name: relative(SCENES_ROOT, file), scene, lines };
});

describe('the rule phase with properties withheld', () => {
  it('runs every rule over the scene corpus without reading properties', () => {
    const reads = corpus.flatMap(({ name, scene }) =>
      propertiesReads(scene).map((read) => `${name}: ${read}`)
    );
    expect(reads).toEqual([]);
  });

  it('finds dangling resource references without reading properties', () => {
    const failures = corpus.flatMap(({ name, scene, lines }) => {
      try {
        danglingResourceDiagnostics(scene, lines);
        return [];
      } catch (error) {
        if (!(error instanceof WithheldRead)) throw error;
        return [`${name}: ${error.message}`];
      }
    });
    expect(failures).toEqual([]);
  });
});

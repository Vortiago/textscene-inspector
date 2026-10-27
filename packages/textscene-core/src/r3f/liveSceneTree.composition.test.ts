/**
 * An inherited sub-scene composes over its base once however many instances there are, and the
 * answer is the one a cold walk gives: the composition is keyed by the cached scene object and
 * stays valid only while the cache answers the same objects it read.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import { collectLiveNodes, liveStep, rootScope, walkLiveTree, type LiveTreeContext } from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';
import { recordingReads } from './cacheSources';

const BASE = `[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="Arm" type="Node3D" parent="."]
unique_name_in_owner = true
`;

const KID = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Kid" instance=ExtResource("base")]

[node name="Hand" type="Node3D" parent="Arm"]
unique_name_in_owner = true
`;

const WRAP = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://kid.tscn" id="kid"]

[node name="Wrap" type="Node3D"]

[node name="K0" parent="." instance=ExtResource("kid")]

[node name="K1" parent="." instance=ExtResource("kid")]
`;

const MAIN = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://kid.tscn" id="kid"]
[ext_resource type="PackedScene" path="res://wrap.tscn" id="wrap"]

[node name="Main" type="Node3D"]

[node name="K0" parent="." instance=ExtResource("kid")]

[node name="K1" parent="." instance=ExtResource("kid")]

[node name="W0" parent="." instance=ExtResource("wrap")]

[node name="W1" parent="." instance=ExtResource("wrap")]
`;

const KIDS = 200;

/** A root with `KIDS` instances of `res://kid.tscn`, which inherits `res://base.tscn`. */
function manyKids(): TscnScene {
  const heading = (i: number) => `\n[node name="K${i}" parent="." instance=ExtResource("kid")]\n`;
  return parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://kid.tscn" id="kid"]

[node name="Main" type="Node3D"]
${Array.from({ length: KIDS }, (_, i) => heading(i)).join('')}`);
}

/** A context over `main`'s pools and `scenes` that counts the reads of each scene path. */
function countingContext(
  main: TscnScene,
  scenes: Record<string, TscnScene>
): { ctx: LiveTreeContext; reads: (path: string) => number } {
  const counts = new Map<string, number>();
  const ctx = contextOver(main, scenes);
  const sceneCache = recordingReads(ctx.sceneCache, (path) => counts.set(path, (counts.get(path) ?? 0) + 1));
  return { ctx: { ...ctx, sceneCache }, reads: (path) => counts.get(path) ?? 0 };
}

const parse = (text: string): TscnScene => new TscnParser().parse(text);

/** The scenes by path, so a test can swap one object for another between walks. */
function sceneRecord(): Record<string, TscnScene> {
  return {
    'res://base.tscn': parse(BASE),
    'res://kid.tscn': parse(KID),
    'res://wrap.tscn': parse(WRAP),
  };
}

function pathsOf(main: TscnScene, ctx: LiveTreeContext): string[] {
  return collectLiveNodes(main.nodes, ctx, () => true).map((entry) => entry.path);
}

/** The `%Name` table of the instance at `path` under `Main`, as its collapse composed it. */
function tableOf(main: TscnScene, ctx: LiveTreeContext, path: string) {
  const entry = collectLiveNodes(main.nodes, ctx, () => true).find((e) => e.path === path);
  return entry!.node.uniqueNames!.paths();
}

describe('a walk over many instances of one inherited scene', () => {
  const noop = () => undefined;

  it('reads the base from the cache once', () => {
    const main = manyKids();
    const { ctx, reads } = countingContext(main, sceneRecord());

    walkLiveTree(main.nodes, ctx, noop);

    expect(reads('res://base.tscn')).toBe(1);
  });

  it('reads the base zero times when it walks the same snapshot again', () => {
    const main = manyKids();
    const { ctx, reads } = countingContext(main, sceneRecord());
    walkLiveTree(main.nodes, ctx, noop);
    const afterFirst = reads('res://base.tscn');

    walkLiveTree(main.nodes, ctx, noop);

    expect(reads('res://base.tscn')).toBe(afterFirst);
  });
});

describe('the composition of an inherited sub-scene', () => {
  it('is one table for two instances of it', () => {
    const main = parse(MAIN);
    const ctx = contextOver(main, sceneRecord());

    expect(tableOf(main, ctx, 'Main/K0')).toBe(tableOf(main, ctx, 'Main/K1'));
  });

  it('is one table for the instances of it inside one enclosing scene', () => {
    const main = parse(MAIN);
    const ctx = contextOver(main, sceneRecord());

    expect(tableOf(main, ctx, 'Main/W0/K0')).toBe(tableOf(main, ctx, 'Main/W1/K1'));
  });

  it('gives the tree a cold walk gives, however often it walks', () => {
    const main = parse(MAIN);
    const warm = contextOver(main, sceneRecord());
    pathsOf(main, warm);

    expect(pathsOf(main, warm)).toEqual(pathsOf(main, contextOver(main, sceneRecord())));
  });

  it('composes over the new base when the cache answers another object for it', () => {
    const main = parse(MAIN);
    const scenes = sceneRecord();
    expect(pathsOf(main, contextOver(main, scenes))).toContain('Main/K0/Arm/Hand');

    scenes['res://base.tscn'] = parse(BASE.replace('Arm', 'Leg'));
    const paths = pathsOf(main, contextOver(main, scenes));

    expect(paths).toContain('Main/K0/Leg');
    expect(paths).not.toContain('Main/K0/Arm');
  });

  it('composes over the base again once the cache has dropped it', () => {
    const main = parse(MAIN);
    const scenes = sceneRecord();
    pathsOf(main, contextOver(main, scenes));

    delete scenes['res://base.tscn'];

    expect(pathsOf(main, contextOver(main, scenes))).not.toContain('Main/K0/Arm');
  });

  it('composes over a base that loads after the first walk', () => {
    const main = parse(MAIN);
    const scenes = sceneRecord();
    const base = scenes['res://base.tscn']!;
    delete scenes['res://base.tscn'];
    expect(pathsOf(main, contextOver(main, scenes))).not.toContain('Main/K0/Arm');

    scenes['res://base.tscn'] = base;

    expect(pathsOf(main, contextOver(main, scenes))).toContain('Main/K0/Arm/Hand');
  });

  it('is read from the cache once by one collapse', () => {
    const main = parse(MAIN);
    const scenes = sceneRecord();
    const reads: string[] = [];
    const full = contextOver(main, scenes);
    const ctx = { ...full, sceneCache: recordingReads(full.sceneCache, (path) => reads.push(path)) };
    const instance = main.nodes[0]!.children.find((n) => n.name === 'K0')!;

    liveStep(instance, rootScope(ctx), ctx.sceneCache);

    expect(reads.filter((path) => path === 'res://kid.tscn')).toHaveLength(1);
  });

  it('keeps a composition for each of two sources that ask in turn', () => {
    const main = parse(MAIN);
    const scenes = sceneRecord();
    const full = contextOver(main, scenes);
    const kidOnly = contextOver(main, { 'res://kid.tscn': scenes['res://kid.tscn']! });
    const fullTable = tableOf(main, full, 'Main/K0');
    tableOf(main, kidOnly, 'Main/K0');

    expect(tableOf(main, contextOver(main, scenes), 'Main/K0')).toBe(fullTable);
  });
});

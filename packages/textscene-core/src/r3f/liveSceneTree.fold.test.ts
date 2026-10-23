/**
 * The fold of the live scene tree: each node gets what its parent passed down and folds its own
 * children through `descend`, so a reader that carries state down or builds a result up needs no
 * walk of its own.
 */
import { describe, expect, it } from 'vitest';
import { foldLiveTree, type LiveWalkEntry } from './liveSceneTree';
import { graftedContext, hostScene } from './testing/graftedScopeFixture';
import './nodes/index';

interface Outline {
  name: string;
  children: Outline[];
}

const outlineOf = (stopAt?: string): Outline[] =>
  foldLiveTree<undefined, Outline>(hostScene.nodes, graftedContext, undefined, ({ step }, _, descend) => ({
    name: step.node.name,
    children: step.node.name === stopAt ? [] : descend(undefined),
  }));

describe('foldLiveTree', () => {
  it('folds the children of each node in the order the tree shows them', () => {
    expect(outlineOf()).toEqual([
      {
        name: 'Host',
        children: [
          {
            name: 'Sub',
            children: [
              {
                name: 'Slot',
                children: [
                  { name: 'Leaf', children: [] },
                  { name: 'Caption', children: [] },
                  { name: 'Pane', children: [{ name: 'Panel', children: [] }] },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it('gives each node what its parent passed down', () => {
    const depths = foldLiveTree<number, string>(
      hostScene.nodes,
      graftedContext,
      0,
      ({ step }, depth, descend) => [`${step.node.name}:${depth}`, ...descend(depth + 1)].join(' ')
    );

    expect(depths).toEqual(['Host:0 Sub:1 Slot:2 Leaf:3 Caption:3 Pane:3 Panel:4']);
  });

  it('prunes the children of a node whose visit does not descend', () => {
    const slot = outlineOf('Slot')[0]!.children[0]!.children[0]!;

    expect(slot).toEqual({ name: 'Slot', children: [] });
  });

  it('tells each node its group and its position in it', () => {
    const entries: LiveWalkEntry[] = [];
    foldLiveTree<undefined, void>(hostScene.nodes, graftedContext, undefined, (entry, _, descend) => {
      entries.push(entry);
      descend(undefined);
    });

    const caption = entries.find((entry) => entry.path === 'Host/Sub/Slot/Caption')!;
    expect(caption.group.children[caption.index]).toBe(caption.raw);
    expect(caption.index).toBe(1);
  });
});

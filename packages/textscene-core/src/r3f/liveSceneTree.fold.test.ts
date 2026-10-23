/**
 * The fold of the live scene tree: each node gets what its parent passed down and folds its own
 * children through `descend`, so a reader that carries state down or builds a result up needs no
 * walk of its own.
 */
import { describe, expect, it } from 'vitest';
import { liveTreeOf, type LiveLink } from './liveSceneTree';
import { graftedContext, hostScene } from './testing/graftedScopeFixture';
import './nodes/index';

interface Outline {
  name: string;
  children: Outline[];
}

const tree = liveTreeOf(hostScene.nodes, graftedContext);

const outlineOf = (stopAt?: string): Outline[] =>
  tree.fold<void, Outline>(undefined, ({ step }, _, descend) => ({
    name: step.node.name,
    children: step.node.name === stopAt ? [] : descend(),
  }));

describe('LiveTree.fold', () => {
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
    const depths = tree.fold<number, string>(0, ({ step }, depth, descend) =>
      [`${step.node.name}:${depth}`, ...descend(depth + 1)].join(' ')
    );

    expect(depths).toEqual(['Host:0 Sub:1 Slot:2 Leaf:3 Caption:3 Pane:3 Panel:4']);
  });

  it('prunes the children of a node whose visit does not descend', () => {
    const slot = outlineOf('Slot')[0]!.children[0]!.children[0]!;

    expect(slot).toEqual({ name: 'Slot', children: [] });
  });

  it('tells each node the group it sits in', () => {
    const entries: LiveLink[] = [];
    tree.fold<void, void>(undefined, (entry, _, descend) => {
      entries.push(entry);
      descend();
    });

    const caption = entries.find((entry) => entry.path === 'Host/Sub/Slot/Caption')!;
    expect(caption.group.children).toContain(caption.raw);
  });

  it('folds the groups below a node it is given, with the steps the tree already took', () => {
    const slot = tree.at('Host/Sub/Slot')!;

    const names = tree.fold<void, string>(
      undefined,
      ({ step }) => step.node.name,
      slot.step.groups,
      slot.path
    );

    expect(names).toEqual(['Leaf', 'Caption', 'Pane']);
    expect(tree.at('Host/Sub/Slot/Caption')!.step).toBe(
      tree.stepOf(slot.step.groups[0]!.children[1]!, slot.step.groups[0]!.scope)
    );
  });
});

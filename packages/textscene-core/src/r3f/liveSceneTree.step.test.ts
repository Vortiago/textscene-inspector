/**
 * The step of the live scene tree: a node as the tree shows it, the scope its refs resolve against
 * and what is below it, from one call. A reader that took the raw node or the group's scope would
 * read the wrong node or the wrong pools.
 */
import { describe, expect, it } from 'vitest';
import { liveTreeOf, rootScope, type LiveStep } from './liveSceneTree';
import { stepOver } from './liveSceneTree.testkit';
import {
  graftedContext,
  hostScene,
  subScene,
  LEAF_PATH,
  CAPTION_PATH,
  SUB_PATH,
} from './testing/graftedScopeFixture';
import './nodes/index';

const tree = liveTreeOf(hostScene.nodes, graftedContext);

const childNames = (step: LiveStep) =>
  step.groups.flatMap((group) => group.children.map((child) => child.name));

describe('the step of a plain node', () => {
  const host = hostScene.nodes[0]!;
  const step = stepOver(host, rootScope(graftedContext), graftedContext.sceneCache);

  it('shows the node itself', () => {
    expect(step.node).toBe(host);
    expect(step.isMerged).toBe(false);
  });

  it('resolves its refs in the scope of the group it sits in', () => {
    expect(step.scope).toEqual(rootScope(graftedContext));
  });

  it('holds its children', () => {
    expect(childNames(step)).toEqual(['Sub']);
  });
});

describe('the step of a merged instance root', () => {
  const sub = tree.at('Host/Sub')!;

  it('shows the sub-scene root it collapsed into, under the instance name', () => {
    expect(sub.step.node).toMatchObject({ name: 'Sub', type: 'Control' });
    expect(sub.step.isMerged).toBe(true);
  });

  it('names the scene the instance node as authored refers to', () => {
    expect(sub.step.instancePath).toBe(SUB_PATH);
  });

  it('resolves its refs in the sub-scene, not in the host that instanced it', () => {
    expect(sub.step.scope.externalResources).toBe(subScene.externalResources);
  });

  it('holds the sub-scene root’s children', () => {
    expect(childNames(sub.step)).toEqual(['Slot']);
  });
});

describe('the step of a grafted node in its authored scope', () => {
  // Both files declare ExtResource "2": the host's is a Label scene, the sub-scene's a Button scene.
  const leaf = tree.at(LEAF_PATH)!;
  const caption = tree.at(CAPTION_PATH)!;

  it('shows the host scene a grafted instance names, not the sub-scene’s', () => {
    expect(leaf.step.node.type).toBe('Label');
  });

  it('resolves the refs of a grafted node in the host scene, though it sits in the sub-scene’s group', () => {
    expect(caption.step.scope.externalResources).toBe(hostScene.externalResources);
  });
});

describe('the step of an editable child of an instance', () => {
  const slot = tree.at('Host/Sub/Slot')!;

  it('resolves its refs in the sub-scene it is part of', () => {
    expect(slot.step.scope.externalResources).toBe(subScene.externalResources);
  });

  it('holds the children the host added below it', () => {
    expect(childNames(slot.step)).toEqual(['Leaf', 'Caption', 'Pane']);
  });

  it('shows an added child as authored', () => {
    expect(tree.at(CAPTION_PATH)!.step.node).toMatchObject({ name: 'Caption', type: 'Label' });
  });
});

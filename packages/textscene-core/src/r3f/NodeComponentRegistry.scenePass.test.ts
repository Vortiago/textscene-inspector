/**
 * Scene passes run once each, transform passes before path passes, whatever
 * order the barrel registered their types in.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { nodeComponentRegistry, type ScenePass } from './NodeComponentRegistry';

const Dummy = () => null;
const paths: ScenePass = (nodes) => nodes;
const transforms: ScenePass = (nodes) => nodes;

describe('nodeComponentRegistry.scenePasses', () => {
  beforeEach(() => nodeComponentRegistry.clear());

  it('orders transform passes ahead of path passes regardless of registration order', () => {
    nodeComponentRegistry.register({
      typeName: 'A',
      Component: Dummy,
      scenePass: { stage: 'paths', run: paths },
    });
    nodeComponentRegistry.register({
      typeName: 'B',
      Component: Dummy,
      scenePass: { stage: 'transforms', run: transforms },
    });
    expect(nodeComponentRegistry.scenePasses()).toEqual([transforms, paths]);
  });

  it('runs a pass two types share once', () => {
    nodeComponentRegistry.register({
      typeName: 'A',
      Component: Dummy,
      scenePass: { stage: 'transforms', run: transforms },
    });
    nodeComponentRegistry.register({
      typeName: 'B',
      Component: Dummy,
      scenePass: { stage: 'transforms', run: transforms },
    });
    expect(nodeComponentRegistry.scenePasses()).toEqual([transforms]);
  });

  it('is empty for types that register no pass', () => {
    nodeComponentRegistry.register({ typeName: 'A', Component: Dummy });
    expect(nodeComponentRegistry.scenePasses()).toEqual([]);
  });
});

describe('nodeComponentRegistry.hasScenePass', () => {
  beforeEach(() => nodeComponentRegistry.clear());

  it('answers per type whether it registered a pass', () => {
    nodeComponentRegistry.register({
      typeName: 'A',
      Component: Dummy,
      scenePass: { stage: 'paths', run: paths },
    });
    nodeComponentRegistry.register({ typeName: 'B', Component: Dummy });
    expect(nodeComponentRegistry.hasScenePass('A')).toBe(true);
    expect(nodeComponentRegistry.hasScenePass('B')).toBe(false);
  });

  it('answers false for an unregistered type', () => {
    expect(nodeComponentRegistry.hasScenePass('Never')).toBe(false);
  });
});

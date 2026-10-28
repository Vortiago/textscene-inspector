/**
 * Parse-time scene passes run once each, transform passes before path passes, whatever order the
 * barrel registered their types in. A live pass runs on the Live scene tree, never at parse time.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { nodeComponentRegistry, type ParseScenePass } from './NodeComponentRegistry';

const Dummy = () => null;
const paths: ParseScenePass = (nodes) => nodes;
const transforms: ParseScenePass = (nodes) => nodes;

describe('nodeComponentRegistry.parseScenePasses', () => {
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
    expect(nodeComponentRegistry.parseScenePasses().map((p) => p.run)).toEqual([transforms, paths]);
  });

  it('runs a pass two types share once, naming both', () => {
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
    expect(nodeComponentRegistry.parseScenePasses()).toEqual([{ run: transforms, typeNames: ['A', 'B'] }]);
  });

  it('is empty for types that register no pass', () => {
    nodeComponentRegistry.register({ typeName: 'A', Component: Dummy });
    expect(nodeComponentRegistry.parseScenePasses()).toEqual([]);
  });

  it('leaves a live pass out of the parse', () => {
    nodeComponentRegistry.register({
      typeName: 'A',
      Component: Dummy,
      scenePass: { stage: 'live' },
    });
    expect(nodeComponentRegistry.parseScenePasses()).toEqual([]);
  });
});

describe('nodeComponentRegistry.scenePassTypeNames', () => {
  beforeEach(() => nodeComponentRegistry.clear());

  it('names every type that registers a pass, on either stage', () => {
    nodeComponentRegistry.register({
      typeName: 'A',
      Component: Dummy,
      scenePass: { stage: 'live' },
    });
    nodeComponentRegistry.register({
      typeName: 'B',
      Component: Dummy,
      scenePass: { stage: 'paths', run: paths },
    });
    nodeComponentRegistry.register({ typeName: 'C', Component: Dummy });
    expect([...nodeComponentRegistry.scenePassTypeNames()]).toEqual(['A', 'B']);
  });
});

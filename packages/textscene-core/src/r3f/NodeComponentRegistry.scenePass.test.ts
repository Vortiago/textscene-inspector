/**
 * A scene pass runs on the Live scene tree, never at parse time. The registry only names the types
 * that drive other nodes through one.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import type { PoseModifierReader } from '../nodes/3d/skeleton3d/poseModifier';

const Dummy = () => null;

describe('nodeComponentRegistry.scenePassTypeNames', () => {
  beforeEach(() => nodeComponentRegistry.clear());

  it('names every type that registers a pass', () => {
    nodeComponentRegistry.register({ typeName: 'A', Component: Dummy, scenePass: true });
    nodeComponentRegistry.register({ typeName: 'B', Component: Dummy, scenePass: true });
    nodeComponentRegistry.register({ typeName: 'C', Component: Dummy });
    expect([...nodeComponentRegistry.scenePassTypeNames()]).toEqual(['A', 'B']);
  });
});

describe('nodeComponentRegistry.poseModifierOf', () => {
  beforeEach(() => nodeComponentRegistry.clear());

  const reader: PoseModifierReader = () => null;

  it('returns the reader a type registers', () => {
    nodeComponentRegistry.register({ typeName: 'A', Component: Dummy, poseModifier: reader });
    expect(nodeComponentRegistry.poseModifierOf('A')).toBe(reader);
  });

  it('is undefined for a type without one and for an unregistered type', () => {
    nodeComponentRegistry.register({ typeName: 'A', Component: Dummy });
    expect(nodeComponentRegistry.poseModifierOf('A')).toBeUndefined();
    expect(nodeComponentRegistry.poseModifierOf('Missing')).toBeUndefined();
  });
});

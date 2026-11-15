/**
 * Tests what a y-sort lift puts back around an item drawn outside the shared live tree: the
 * ancestors it was lifted past still name a `texture_filter` and `texture_repeat` for it to inherit,
 * and the space a top_level item below cancels is the one the restored groups draw in.
 */
import { useEffect } from 'react';
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { LiftedAncestors } from './LiftedAncestors';
import { samplerProbe } from './testing/samplerProbe';
import type { CanvasItemTextureSampler } from './canvasItemTextureSampler';
import { ROOT_TEXTURE_SAMPLER, type AmbientTextureSampler } from './textureSamplerInheritance';
import { InheritedFrom, inheritedState } from './testing/inheritedFrom';
import { parseNode2D } from '../nodes/base/node2d/parser';
import type { TscnNode } from '../parser/types';
import { useCanvasSpace } from './canvasRootScope';
import { YSortProvider, usePublishControlTransforms } from './contexts/YSortContext';
import { transform2DFromParts } from '../godot/math/transform2d';

const NEAREST = 1;
const LINEAR = 2;
const REPEAT_MIRROR = 3;

function container(name: string, raw: Record<string, string>): TscnNode {
  const heading = { type: 'node', attributes: { type: 'Node2D', name } };
  return { rawProperties: {}, name, type: 'Node2D', children: [], properties: parseNode2D(heading, raw) };
}

/** What a lifted item inherits when it was lifted past `liftedPast`, inside an ambient sampler. */
async function inheritedBy(
  liftedPast: readonly TscnNode[],
  ambient: AmbientTextureSampler = ROOT_TEXTURE_SAMPLER
): Promise<CanvasItemTextureSampler> {
  const { Probe, resolved } = samplerProbe();
  await ReactThreeTestRenderer.create(
    <InheritedFrom state={inheritedState({ sampler: ambient })}>
      <LiftedAncestors liftedPast={liftedPast} basePath="Root">
        <Probe />
      </LiftedAncestors>
    </InheritedFrom>
  );
  return resolved();
}

describe('LiftedAncestors texture sampler', () => {
  it('hands the item the filter and repeat of the ancestors it was lifted past', async () => {
    const lifted = [container('Outer', { texture_filter: String(NEAREST) }), container('Inner', {})];
    expect((await inheritedBy(lifted)).filter).toBe(NEAREST);
  });

  it('lets the innermost ancestor that names a value win, as the nearest ancestor does', async () => {
    const lifted = [
      container('Outer', { texture_filter: String(NEAREST), texture_repeat: String(REPEAT_MIRROR) }),
      container('Inner', { texture_filter: String(LINEAR) }),
    ];
    expect(await inheritedBy(lifted)).toMatchObject({ filter: LINEAR, repeat: REPEAT_MIRROR });
  });

  it('keeps what the ambient names when no lifted ancestor does', async () => {
    const lifted = [container('Outer', {})];
    expect((await inheritedBy(lifted, { filter: NEAREST, repeat: undefined })).filter).toBe(NEAREST);
  });
});

/** Publishes the transform the Control walk solved for `path`, as the walk does once it solves. */
function SolvedControl({ path, x }: { path: string; x: number }) {
  const publish = usePublishControlTransforms();
  useEffect(() => {
    publish?.('walk', new Map([[path, transform2DFromParts(0, { x: 1, y: 1 }, 0, { x, y: 0 })]]));
  }, [publish, path, x]);
  return null;
}

describe('LiftedAncestors canvas space', () => {
  it('composes a lifted Control at the transform the Control walk solved for it', async () => {
    const box: TscnNode = { rawProperties: {}, name: 'Box', type: 'Control', children: [], properties: {} };
    let space: THREE.Matrix4 | null = null;
    function SpaceProbe() {
      space = useCanvasSpace();
      return null;
    }
    await ReactThreeTestRenderer.create(
      <YSortProvider>
        <SolvedControl path="Root/Box" x={100} />
        <LiftedAncestors liftedPast={[box]} basePath="Root">
          <SpaceProbe />
        </LiftedAncestors>
      </YSortProvider>
    );
    expect(space!.elements[12]).toBe(100);
  });
});

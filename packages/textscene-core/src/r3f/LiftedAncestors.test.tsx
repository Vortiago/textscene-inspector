/**
 * Tests the CanvasItem state a y-sort lift puts back around an item: the ancestors it was lifted
 * past still name a `texture_filter` and `texture_repeat` for it to inherit.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { LiftedAncestors } from './LiftedAncestors';
import { samplerProbe } from './testing/samplerProbe';
import {
  ROOT_TEXTURE_SAMPLER,
  TextureSampler2DContext,
  type AmbientTextureSampler,
  type CanvasItemTextureSampler,
} from './canvasItemTextureSampler';
import { parseNode2D } from '../nodes/base/node2d/parser';
import type { TscnNode } from '../parser/types';

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
    <TextureSampler2DContext.Provider value={ambient}>
      <LiftedAncestors liftedPast={liftedPast} basePath="Root">
        <Probe />
      </LiftedAncestors>
    </TextureSampler2DContext.Provider>
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

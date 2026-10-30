import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { testRenderer } from '../../testing/recordingWebGL';
import { handleOf } from '../sharedTexture';
import { DECAL_FIRST_ROW } from './sceneRowsChunk';
import { SCENE_ROW_TEXELS } from './sceneRowTexels';
import { SceneRows } from './sceneRows';
import { sceneRowsSlot } from './sceneRowsSlot';

const ROW_FLOATS = SCENE_ROW_TEXELS * 4;

/** `count` rows with every float set to `value`. */
function rows(count: number, value: number) {
  return { data: new Float32Array(Math.max(1, count) * ROW_FLOATS).fill(value), count };
}

async function sceneRows() {
  const { renderer } = await testRenderer();
  return { renderer, sceneRows: new SceneRows(renderer) };
}

/** The float at the start of row `row` of `texture`. */
function firstFloatOf(row: number, texture: THREE.DataTexture): number {
  return (texture.image.data as Float32Array)[row * ROW_FLOATS]!;
}

describe('SceneRows', () => {
  it('puts the probe rows first', async () => {
    const { sceneRows: shared } = await sceneRows();

    shared.setProbes(rows(2, 3));

    expect(firstFloatOf(1, shared.texture())).toBe(3);
  });

  it('puts the decal rows after the rows the probes may fill', async () => {
    const { sceneRows: shared } = await sceneRows();

    shared.setDecals(rows(2, 5));

    expect(firstFloatOf(DECAL_FIRST_ROW + 1, shared.texture())).toBe(5);
  });

  it('keeps the probe rows when the decal rows change', async () => {
    const { sceneRows: shared } = await sceneRows();
    shared.setProbes(rows(1, 3));

    shared.setDecals(rows(1, 5));

    expect(firstFloatOf(0, shared.texture())).toBe(3);
  });

  it('keeps the decal rows when the probe rows change', async () => {
    const { sceneRows: shared } = await sceneRows();
    shared.setDecals(rows(1, 5));

    shared.setProbes(rows(1, 3));

    expect(firstFloatOf(DECAL_FIRST_ROW, shared.texture())).toBe(5);
  });

  it('uploads again once a band changes, and not before', async () => {
    const { sceneRows: shared } = await sceneRows();
    shared.setDecals(rows(3, 3));
    shared.show();
    const { version } = shared.texture();

    shared.show();
    expect(shared.texture().version).toBe(version);

    shared.setDecals(rows(2, 5));
    shared.show();
    expect(shared.texture().version).toBe(version + 1);
  });

  it('shows its texture in the slot every program samples', async () => {
    const { renderer, sceneRows: shared } = await sceneRows();
    shared.setDecals(rows(1, 5));

    shared.show();

    expect(handleOf(renderer, sceneRowsSlot).__webglTexture).toBe(
      handleOf(renderer, shared.texture()).__webglTexture
    );
  });

  it('takes the slot off its texture when more decals make the texture grow', async () => {
    const { renderer, sceneRows: shared } = await sceneRows();
    shared.setDecals(rows(1, 5));
    shared.show();
    const first = shared.texture();

    shared.setDecals(rows(DECAL_FIRST_ROW * 3, 5));
    shared.show();

    expect(shared.texture()).not.toBe(first);
    expect(handleOf(renderer, sceneRowsSlot).__webglTexture).toBe(
      handleOf(renderer, shared.texture()).__webglTexture
    );
  });

  it('takes the slot off its texture when it is disposed', async () => {
    const { renderer, sceneRows: shared } = await sceneRows();
    shared.setDecals(rows(1, 5));
    shared.show();

    shared.dispose();

    expect(handleOf(renderer, sceneRowsSlot).__webglTexture).toBeUndefined();
  });
});

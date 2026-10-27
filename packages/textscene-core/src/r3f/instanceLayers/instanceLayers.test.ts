import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { restoreInstanceLayers, showInstanceLayers } from './instanceLayers';
import { instanceLayers } from './instanceLayersChunk';
import { shownProbes } from '../reflectionProbe/probeSlots';
import { shownDecals } from '../decal/decalSlots';
import { setVisualLayers } from '../visualLayers';
import { testRenderer } from '../../testing/recordingWebGL';

beforeEach(() => {
  shownProbes[0] = 1;
});

afterEach(() => {
  restoreInstanceLayers();
  shownProbes[0] = 0;
  shownDecals[0] = 0;
  vi.restoreAllMocks();
});

function meshOnLayers(layers: number): THREE.Mesh {
  const mesh = new THREE.Mesh();
  setVisualLayers(mesh, layers);
  return mesh;
}

describe('showInstanceLayers', () => {
  it("shows the drawn instance's layers, and has three upload them again on the target it draws to", async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLCubeRenderTarget(4);
    renderer.setRenderTarget(target, 3, 1);
    const set = vi.spyOn(renderer, 'setRenderTarget');

    showInstanceLayers(renderer, meshOnLayers(4));

    expect(instanceLayers[0]).toBe(4);
    expect(set).toHaveBeenCalledWith(target, 3, 1);
  });

  it("leaves three's uploads alone for an instance on the default layer (edge case)", async () => {
    const { renderer } = await testRenderer();
    const set = vi.spyOn(renderer, 'setRenderTarget');

    showInstanceLayers(renderer, new THREE.Mesh());

    expect(instanceLayers[0]).toBe(1);
    expect(set).not.toHaveBeenCalled();
  });

  it('leaves them alone in a render that shows no probe and no decal (edge case)', async () => {
    const { renderer } = await testRenderer();
    shownProbes[0] = 0;
    const set = vi.spyOn(renderer, 'setRenderTarget');

    showInstanceLayers(renderer, meshOnLayers(4));

    expect(instanceLayers[0]).toBe(1);
    expect(set).not.toHaveBeenCalled();
  });

  it('shows them in a render that shows decals and no probe', async () => {
    const { renderer } = await testRenderer();
    shownProbes[0] = 0;
    shownDecals[0] = 2;

    showInstanceLayers(renderer, meshOnLayers(4));

    expect(instanceLayers[0]).toBe(4);
  });
});

describe('restoreInstanceLayers', () => {
  it('puts the default layer back, uploaded again for the next draw', async () => {
    const { renderer } = await testRenderer();
    showInstanceLayers(renderer, meshOnLayers(0));
    const set = vi.spyOn(renderer, 'setRenderTarget');

    restoreInstanceLayers();

    expect(instanceLayers[0]).toBe(1);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('does nothing after a draw that showed nothing (edge case)', async () => {
    const { renderer } = await testRenderer();
    const set = vi.spyOn(renderer, 'setRenderTarget');

    restoreInstanceLayers();

    expect(set).not.toHaveBeenCalled();
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { vec4 } from 'three/tsl';
import type { NodeFrame } from 'three/webgpu';
import { generatedFragmentShader } from './generatedShader.testkit.js';
import { LightRows } from './lightRows.js';

const ROWS = 3;

function sceneLight(): THREE.Light {
  const light = new THREE.DirectionalLight();
  new THREE.Scene().add(light);
  return light;
}

const noWrite = () => {};

/** Runs the array's update, as the handler does once per render. */
function renderUpdate(rows: LightRows): void {
  rows.update({} as NodeFrame);
}

describe('LightRows', () => {
  it('gives one light the same slot on every call', () => {
    const rows = new LightRows(ROWS, 2);
    const light = sceneLight();

    expect(rows.slotFor(light, noWrite)).toBe(0);
    expect(rows.slotFor(light, noWrite)).toBe(0);
  });

  it('gives each light its own slot, in the order they ask', () => {
    const rows = new LightRows(ROWS, 2);

    expect(rows.slotFor(sceneLight(), noWrite)).toBe(0);
    expect(rows.slotFor(sceneLight(), noWrite)).toBe(1);
  });

  it('answers null for a light past the count while every slot holds a light in a scene', () => {
    const rows = new LightRows(ROWS, 1);
    rows.slotFor(sceneLight(), noWrite);

    expect(rows.slotFor(sceneLight(), noWrite)).toBeNull();
  });

  it('hands the slot of a light that left its scene to the next light', () => {
    const rows = new LightRows(ROWS, 1);
    const removed = sceneLight();
    rows.slotFor(removed, noWrite);
    removed.removeFromParent();

    expect(rows.slotFor(sceneLight(), noWrite)).toBe(0);
  });

  it('hands the slot of a light whose group left its scene to the next light (edge case)', () => {
    const rows = new LightRows(ROWS, 1);
    const group = new THREE.Group();
    const removed = new THREE.DirectionalLight();
    group.add(removed);
    new THREE.Scene().add(group);
    rows.slotFor(removed, noWrite);
    group.removeFromParent();

    expect(rows.slotFor(sceneLight(), noWrite)).toBe(0);
  });

  it('writes no rows for a light that left its scene', () => {
    const rows = new LightRows(ROWS, 1);
    const removed = sceneLight();
    const writer = vi.fn();
    rows.slotFor(removed, writer);
    removed.removeFromParent();

    renderUpdate(rows);

    expect(writer).not.toHaveBeenCalled();
  });

  it('writes each slot’s rows through its light’s writer on the update', () => {
    const rows = new LightRows(ROWS, 2);
    rows.slotFor(sceneLight(), noWrite);
    rows.slotFor(sceneLight(), (write) => write(2, 1, 2, 3, 4));

    renderUpdate(rows);

    expect(rows.values[1 * ROWS + 2]!.toArray()).toEqual([1, 2, 3, 4]);
  });

  it('reads a field of a slot as one element of the shared array', () => {
    const rows = new LightRows(ROWS, 2);

    const shader = generatedFragmentShader(vec4(rows.row(1, 2)));

    expect(shader).toContain('nodeUniform0[ 5u ]');
    expect(shader).toContain('vec4 nodeUniform0[6];');
  });
});

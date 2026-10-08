/**
 * The Godot render-layer mask carried on THREE `userData`: the writer a slice
 * hands R3F, and the reader a consumer (currently `Decal.cull_mask`) filters with.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GODOT_DEFAULT_VISUAL_LAYERS,
  setVisualLayers,
  visualLayersOf,
  visualLayersUserData,
} from './visualLayers';

describe('visualLayersUserData', () => {
  it('carries an authored layers mask', () => {
    expect(visualLayersUserData(2)).toEqual({ godotLayers: 2 });
  });

  it("resolves an absent layers property to Godot's default", () => {
    expect(visualLayersUserData(undefined)).toEqual({ godotLayers: GODOT_DEFAULT_VISUAL_LAYERS });
    expect(visualLayersUserData()).toEqual({ godotLayers: 1 });
  });

  it('keeps a zero mask rather than defaulting it — Godot allows "no layers"', () => {
    expect(visualLayersUserData(0)).toEqual({ godotLayers: 0 });
  });
});

describe('visualLayersOf', () => {
  it('reads a stamped mask back', () => {
    const mesh = new THREE.Mesh();
    Object.assign(mesh.userData, visualLayersUserData(2));

    expect(visualLayersOf(mesh)).toBe(2);
  });

  it("reads an untagged object as Godot's default", () => {
    expect(visualLayersOf(new THREE.Mesh())).toBe(GODOT_DEFAULT_VISUAL_LAYERS);
  });

  it('ignores a non-numeric tag rather than propagating it into a bitwise test', () => {
    const mesh = new THREE.Mesh();
    mesh.userData.godotLayers = 'ThisIsNotAMask';

    expect(visualLayersOf(mesh)).toBe(GODOT_DEFAULT_VISUAL_LAYERS);
  });

  it('does not inherit a parent mask — Godot applies layers per instance', () => {
    const parent = new THREE.Group();
    Object.assign(parent.userData, visualLayersUserData(2));
    const child = new THREE.Mesh();
    parent.add(child);

    expect(visualLayersOf(child)).toBe(GODOT_DEFAULT_VISUAL_LAYERS);
  });
});

describe('setVisualLayers', () => {
  it('sets the mask of the object alone, not of its children', () => {
    const mesh = new THREE.Mesh();
    const child = new THREE.Mesh();
    mesh.add(child);

    setVisualLayers(mesh, 2);

    expect([visualLayersOf(mesh), visualLayersOf(child)]).toEqual([2, GODOT_DEFAULT_VISUAL_LAYERS]);
  });

  it('overwrites an earlier mask', () => {
    const mesh = new THREE.Mesh();
    setVisualLayers(mesh, 2);
    setVisualLayers(mesh, 8);

    expect(visualLayersOf(mesh)).toBe(8);
  });

  it('sets a mask of zero, which no decal or camera matches', () => {
    const mesh = new THREE.Mesh();
    setVisualLayers(mesh, 0);

    expect(visualLayersOf(mesh)).toBe(0);
  });
});

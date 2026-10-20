/**
 * `readRenderRegistrations` over the real slices, and the guard the outliner badge and the
 * inspector notice rest on: a registration's `renderIntent` agrees with what its component draws.
 */

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { NODES_ROOT, parseRegistrationCalls, readRenderRegistrations } from './renderRegistrations.mjs';

const registrations = readRenderRegistrations();
const ofIntent = (intent) => [...registrations.values()].filter((r) => r.intent === intent);

describe('parseRegistrationCalls', () => {
  it('reads the type, the intent and the component module of one call', () => {
    const source = `
      import { Node3D } from '../../../base/node3d/Component';
      nodeComponentRegistry.register({ typeName: 'LightmapProbe', Component: Node3D, renderIntent: 'pending' });`;
    expect(parseRegistrationCalls(source)).toEqual([
      {
        registry: 'node',
        typeName: 'LightmapProbe',
        loopConstant: null,
        componentFrom: '../../../base/node3d/Component',
        intent: 'pending',
        scenePass: false,
      },
    ]);
  });

  it('reads a component the file defines, or renames on import, as its own', () => {
    const source = `
      import { Label as LabelDrawer } from './Component';
      function Local() { return null; }
      controlComponentRegistry.register({ typeName: 'Label', Component: LabelDrawer });
      nodeComponentRegistry.register({ typeName: 'Other', Component: Local });`;
    const [label, other] = parseRegistrationCalls(source);
    expect(label.componentFrom).toBe('./Component');
    expect(label.registry).toBe('control');
    expect(other.componentFrom).toBeNull();
  });

  it('defaults the intent to `draws` and names the list of a family loop', () => {
    const source = `
      import { Node2D } from '../../base/node2d/Component';
      import { TWO_D_PHYSICS_TYPES } from './index';
      for (const typeName of TWO_D_PHYSICS_TYPES) {
        nodeComponentRegistry.register({ typeName, Component: Node2D });
      }`;
    const [call] = parseRegistrationCalls(source);
    expect(call.typeName).toBeNull();
    expect(call.loopConstant).toBe('TWO_D_PHYSICS_TYPES');
    expect(call.intent).toBe('draws');
  });

  it('finds no call in a source without a registration', () => {
    expect(parseRegistrationCalls("export const X = ['A'];")).toEqual([]);
  });
});

describe('readRenderRegistrations', () => {
  it('credits a family loop to each type its sibling list names', () => {
    const family = join(NODES_ROOT, 'physics/2d/index.r3f.ts');
    const credited = [...registrations.values()].filter((r) => r.file === family).map((r) => r.type);
    expect(credited.sort()).toEqual(['CharacterBody2D', 'RigidBody2D', 'StaticBody2D']);
  });

  it('tells a mounted invisible base from a drawing component', () => {
    expect(registrations.get('MeshInstance3D')?.drawsOwnVisual).toBe(true);
    expect(registrations.get('LightmapProbe')?.drawsOwnVisual).toBe(false);
    // `undrawnGeometryInstance` mounts the GeometryInstance3D base.
    expect(registrations.get('CPUParticles3D')?.drawsOwnVisual).toBe(false);
  });

  it("takes a 2D-UI type's drawer from its Control registration and its intent from the 3D one", () => {
    // The 3D registration mounts `Node` to pass through; the Control component draws.
    expect(registrations.get('SubViewportContainer')).toMatchObject({
      intent: 'draws',
      drawsOwnVisual: true,
    });
  });

  it('finds every intent, so a bad parse cannot pass the guards below vacuously', () => {
    expect(ofIntent('draws').length).toBeGreaterThan(50);
    expect(ofIntent('pending').length).toBeGreaterThan(20);
    expect(ofIntent('transform-only').length).toBeGreaterThan(20);
  });
});

describe('the declared render intent agrees with the component', () => {
  it('gives every `draws` registration a component that draws', () => {
    // The badge reads `draws` as finished. A bare base under it shows a gap as done.
    const bad = ofIntent('draws')
      .filter((r) => !r.drawsOwnVisual)
      .map((r) => `${r.type}: registers draws but mounts only an invisible base`);
    expect(bad).toEqual([]);
  });

  it('gives every `pending` registration only an invisible base', () => {
    // The badge and the inspector say a pending node is not drawn, so a drawing component
    // under it shows a drawn node as missing.
    const bad = ofIntent('pending')
      .filter((r) => r.drawsOwnVisual)
      .map((r) => `${r.type}: registers pending but its component draws`);
    expect(bad).toEqual([]);
  });
});

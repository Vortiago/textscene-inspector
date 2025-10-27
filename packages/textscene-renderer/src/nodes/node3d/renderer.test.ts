/**
 * Tests for Node3D renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNode3DGizmo, applyNode3DTransform } from './renderer';
import type { Node3DProperties } from './types';

describe('createNode3DGizmo', () => {
  it('should create an empty THREE.Group', () => {
    const gizmo = createNode3DGizmo('TestNode');

    expect(gizmo).toBeInstanceOf(THREE.Group);
    expect(gizmo.name).toBe('TestNode');
    expect(gizmo.children).toHaveLength(0);
  });

  it('should set the correct name', () => {
    const gizmo = createNode3DGizmo('MyNode3D');

    expect(gizmo.name).toBe('MyNode3D');
  });
});

describe('applyNode3DTransform', () => {
  it('should apply position from transform', () => {
    const object = new THREE.Object3D();
    const properties: Node3DProperties = {
      name: 'Test',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 5, y: 10, z: 15 },
      },
    };

    applyNode3DTransform(object, properties);

    expect(object.position.x).toBeCloseTo(5);
    expect(object.position.y).toBeCloseTo(10);
    expect(object.position.z).toBeCloseTo(15);
  });

  it('should apply scale from transform', () => {
    const object = new THREE.Object3D();
    const properties: Node3DProperties = {
      name: 'Test',
      transform: {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 3, z: 0 },
        basis_z: { x: 0, y: 0, z: 4 },
        origin: { x: 0, y: 0, z: 0 },
      },
    };

    applyNode3DTransform(object, properties);

    expect(object.scale.x).toBeCloseTo(2);
    expect(object.scale.y).toBeCloseTo(3);
    expect(object.scale.z).toBeCloseTo(4);
  });

  it('should apply rotation from transform', () => {
    const object = new THREE.Object3D();

    // 90-degree rotation around Y axis
    // cos(90°) = 0, sin(90°) = 1
    const properties: Node3DProperties = {
      name: 'Test',
      transform: {
        basis_x: { x: 0, y: 0, z: 1 },  // Rotated X axis
        basis_y: { x: 0, y: 1, z: 0 },  // Y axis unchanged
        basis_z: { x: -1, y: 0, z: 0 }, // Rotated Z axis
        origin: { x: 0, y: 0, z: 0 },
      },
    };

    applyNode3DTransform(object, properties);

    // Should have rotation around Y axis
    expect(object.rotation.x).toBeCloseTo(0, 5);
    expect(object.rotation.y).toBeCloseTo(Math.PI / 2, 5); // 90 degrees
    expect(object.rotation.z).toBeCloseTo(0, 5);
  });

  it('should handle identity transform', () => {
    const object = new THREE.Object3D();
    const properties: Node3DProperties = {
      name: 'Test',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
      },
    };

    applyNode3DTransform(object, properties);

    expect(object.position.x).toBeCloseTo(0);
    expect(object.position.y).toBeCloseTo(0);
    expect(object.position.z).toBeCloseTo(0);
    expect(object.rotation.x).toBeCloseTo(0);
    expect(object.rotation.y).toBeCloseTo(0);
    expect(object.rotation.z).toBeCloseTo(0);
    expect(object.scale.x).toBeCloseTo(1);
    expect(object.scale.y).toBeCloseTo(1);
    expect(object.scale.z).toBeCloseTo(1);
  });

  it('should handle missing transform (no-op)', () => {
    const object = new THREE.Object3D();
    object.position.set(1, 2, 3);

    const properties: Node3DProperties = {
      name: 'Test',
      // No transform property
    };

    applyNode3DTransform(object, properties);

    // Should remain at original position
    expect(object.position.x).toBe(1);
    expect(object.position.y).toBe(2);
    expect(object.position.z).toBe(3);
  });

  it('should handle combined transform (position + rotation + scale)', () => {
    const object = new THREE.Object3D();

    // Combined: scale 2, no rotation, translate (1, 2, 3)
    const properties: Node3DProperties = {
      name: 'Test',
      transform: {
        basis_x: { x: 2, y: 0, z: 0 },
        basis_y: { x: 0, y: 2, z: 0 },
        basis_z: { x: 0, y: 0, z: 2 },
        origin: { x: 1, y: 2, z: 3 },
      },
    };

    applyNode3DTransform(object, properties);

    expect(object.position.x).toBeCloseTo(1);
    expect(object.position.y).toBeCloseTo(2);
    expect(object.position.z).toBeCloseTo(3);
    expect(object.scale.x).toBeCloseTo(2);
    expect(object.scale.y).toBeCloseTo(2);
    expect(object.scale.z).toBeCloseTo(2);
  });
});

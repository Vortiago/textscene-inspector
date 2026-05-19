/**
 * CapsuleMesh parser and renderer tests
 */

import { describe, it, expect } from 'vitest';
import { parseCapsuleMesh } from './parser';
import { createCapsuleMeshGeometry } from './renderer';
import * as THREE from 'three';

describe('CapsuleMesh Parser', () => {
  it('should parse CapsuleMesh with default values', () => {
    const properties = {};
    const result = parseCapsuleMesh(properties);

    expect(result.radius).toBe(0.5);
    expect(result.height).toBe(2.0);
    expect(result.radialSegments).toBe(64);
    expect(result.rings).toBe(8);
  });

  it('should parse custom CapsuleMesh properties', () => {
    const properties = {
      radius: '1.0',
      height: '3.0',
      radial_segments: '32',
      rings: '4',
    };
    const result = parseCapsuleMesh(properties);

    expect(result.radius).toBe(1.0);
    expect(result.height).toBe(3.0);
    expect(result.radialSegments).toBe(32);
    expect(result.rings).toBe(4);
  });

  it('should handle invalid radius gracefully', () => {
    const properties = {
      radius: 'invalid',
    };
    const result = parseCapsuleMesh(properties);

    expect(result.radius).toBe(0.5); // Falls back to default
  });

  it('should handle invalid height gracefully', () => {
    const properties = {
      height: 'not_a_number',
    };
    const result = parseCapsuleMesh(properties);

    expect(result.height).toBe(2.0); // Falls back to default
  });

  it('should handle invalid radial_segments gracefully', () => {
    const properties = {
      radial_segments: 'invalid',
    };
    const result = parseCapsuleMesh(properties);

    expect(result.radialSegments).toBe(64); // Falls back to default
  });

  it('should handle invalid rings gracefully', () => {
    const properties = {
      rings: 'invalid',
    };
    const result = parseCapsuleMesh(properties);

    expect(result.rings).toBe(8); // Falls back to default
  });
});

describe('CapsuleMesh Renderer', () => {
  it('should create CapsuleGeometry with correct parameters', () => {
    const props = {
      radius: 0.5,
      height: 3.0,
      radialSegments: 32,
      rings: 8,
    };

    const geometry = createCapsuleMeshGeometry(props);

    expect(geometry).toBeInstanceOf(THREE.CapsuleGeometry);
    expect(geometry.parameters.radius).toBe(0.5);
    // three.js length = Godot height - 2 * radius
    // 3.0 - 2 * 0.5 = 2.0
    expect(geometry.parameters.height).toBeCloseTo(2.0);
    expect(geometry.parameters.capSegments).toBe(8);
    expect(geometry.parameters.radialSegments).toBe(32);
  });

  it('should enforce minimum length of 0.01', () => {
    const props = {
      radius: 1.0,
      height: 1.5, // Less than 2 * radius
      radialSegments: 32,
      rings: 8,
    };

    const geometry = createCapsuleMeshGeometry(props);

    // Should clamp to minimum 0.01 instead of going negative
    expect(geometry.parameters.height).toBeGreaterThanOrEqual(0.01);
  });

  it('should handle default capsule dimensions', () => {
    const props = {
      radius: 0.5,
      height: 2.0,
      radialSegments: 64,
      rings: 8,
    };

    const geometry = createCapsuleMeshGeometry(props);

    expect(geometry.parameters.radius).toBe(0.5);
    expect(geometry.parameters.height).toBeCloseTo(1.0);
  });

  it('should convert height correctly for various radii', () => {
    const props = {
      radius: 2.0,
      height: 10.0,
      radialSegments: 32,
      rings: 8,
    };

    const geometry = createCapsuleMeshGeometry(props);

    // 10.0 - 2 * 2.0 = 6.0
    expect(geometry.parameters.height).toBeCloseTo(6.0);
  });
});

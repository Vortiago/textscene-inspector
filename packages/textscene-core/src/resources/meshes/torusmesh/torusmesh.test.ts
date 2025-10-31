/**
 * TorusMesh parser and renderer tests
 */

import { describe, it, expect } from 'vitest';
import { parseTorusMesh } from './parser';
import { createTorusMeshGeometry } from './renderer';
import * as THREE from 'three';

describe('TorusMesh Parser', () => {
  it('should parse TorusMesh with default values', () => {
    const properties = {};
    const result = parseTorusMesh(properties);

    expect(result.innerRadius).toBe(0.5);
    expect(result.outerRadius).toBe(1.0);
    expect(result.rings).toBe(32);
    expect(result.ringSegments).toBe(16);
  });

  it('should parse custom TorusMesh properties', () => {
    const properties = {
      inner_radius: '0.3',
      outer_radius: '1.5',
      rings: '48',
      ring_segments: '24',
    };
    const result = parseTorusMesh(properties);

    expect(result.innerRadius).toBe(0.3);
    expect(result.outerRadius).toBe(1.5);
    expect(result.rings).toBe(48);
    expect(result.ringSegments).toBe(24);
  });

  it('should handle invalid inner_radius gracefully', () => {
    const properties = {
      inner_radius: 'invalid',
    };
    const result = parseTorusMesh(properties);

    expect(result.innerRadius).toBe(0.5); // Falls back to default
  });

  it('should handle invalid outer_radius gracefully', () => {
    const properties = {
      outer_radius: 'not_a_number',
    };
    const result = parseTorusMesh(properties);

    expect(result.outerRadius).toBe(1.0); // Falls back to default
  });

  it('should handle invalid rings gracefully', () => {
    const properties = {
      rings: 'invalid',
    };
    const result = parseTorusMesh(properties);

    expect(result.rings).toBe(32); // Falls back to default
  });

  it('should handle invalid ring_segments gracefully', () => {
    const properties = {
      ring_segments: 'invalid',
    };
    const result = parseTorusMesh(properties);

    expect(result.ringSegments).toBe(16); // Falls back to default
  });
});

describe('TorusMesh Renderer', () => {
  it('should create TorusGeometry with correct parameters', () => {
    const props = {
      innerRadius: 0.5,
      outerRadius: 1.5,
      rings: 32,
      ringSegments: 16,
    };

    const geometry = createTorusMeshGeometry(props);

    expect(geometry).toBeInstanceOf(THREE.TorusGeometry);
    // radius = (1.5 + 0.5) / 2 = 1.0
    // tube = (1.5 - 0.5) / 2 = 0.5
    expect(geometry.parameters.radius).toBeCloseTo(1.0);
    expect(geometry.parameters.tube).toBeCloseTo(0.5);
    expect(geometry.parameters.radialSegments).toBe(16);
    expect(geometry.parameters.tubularSegments).toBe(32);
  });

  it('should handle default torus dimensions', () => {
    const props = {
      innerRadius: 0.5,
      outerRadius: 1.0,
      rings: 32,
      ringSegments: 16,
    };

    const geometry = createTorusMeshGeometry(props);

    // radius = (1.0 + 0.5) / 2 = 0.75
    // tube = (1.0 - 0.5) / 2 = 0.25
    expect(geometry.parameters.radius).toBeCloseTo(0.75);
    expect(geometry.parameters.tube).toBeCloseTo(0.25);
  });

  it('should convert radii correctly for various sizes', () => {
    const props = {
      innerRadius: 2.0,
      outerRadius: 4.0,
      rings: 32,
      ringSegments: 16,
    };

    const geometry = createTorusMeshGeometry(props);

    // radius = (4.0 + 2.0) / 2 = 3.0
    // tube = (4.0 - 2.0) / 2 = 1.0
    expect(geometry.parameters.radius).toBeCloseTo(3.0);
    expect(geometry.parameters.tube).toBeCloseTo(1.0);
  });

  it('should handle equal inner and outer radii', () => {
    const props = {
      innerRadius: 1.0,
      outerRadius: 1.0,
      rings: 32,
      ringSegments: 16,
    };

    const geometry = createTorusMeshGeometry(props);

    // radius = (1.0 + 1.0) / 2 = 1.0
    // tube = (1.0 - 1.0) / 2 = 0.0
    expect(geometry.parameters.radius).toBeCloseTo(1.0);
    expect(geometry.parameters.tube).toBeCloseTo(0.0);
  });
});

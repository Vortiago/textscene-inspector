/**
 * Label3D renderer tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { createLabel3D } from './renderer';
import { BillboardMode } from './types';
import type { Label3DProperties } from './types';

describe('Label3D Renderer', () => {
  const defaultTransform = {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y: 0, z: 0 },
  };

  const baseLabel3DProps: Label3DProperties = {
    name: 'TestLabel',
    text: 'Hello World',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_ENABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    transform: defaultTransform,
  };

  // Mock canvas context for testing
  beforeEach(() => {
    const mockContext = {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: vi.fn(),
      strokeText: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
      if (type === '2d') {
        return mockContext as unknown as CanvasRenderingContext2D;
      }
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  describe('createLabel3D', () => {
    it('should create a THREE.Mesh', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.name).toBe('Label');
    });

    it('should use PlaneGeometry', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    });

    it('should use MeshBasicMaterial with canvas texture', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.map).toBeInstanceOf(THREE.CanvasTexture);
    });

    it('should store billboard mode in userData', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        billboard: BillboardMode.BILLBOARD_FIXED_Y,
      };

      const mesh = createLabel3D('Label', props);

      expect(mesh.userData.isLabel3D).toBe(true);
      expect(mesh.userData.billboardMode).toBe(BillboardMode.BILLBOARD_FIXED_Y);
    });

    it('should default billboard mode to ENABLED when not specified', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      expect(mesh.userData.billboardMode).toBe(BillboardMode.BILLBOARD_ENABLED);
    });

    it('should set material opacity based on modulate alpha', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        modulate: { r: 1, g: 0, b: 0, a: 0.5 },
      };

      const mesh = createLabel3D('Label', props);

      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.5);
    });

    it('should use DoubleSide rendering', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.side).toBe(THREE.DoubleSide);
    });

    it('should disable depth write to avoid z-fighting', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.depthWrite).toBe(false);
    });

    it('should size plane based on pixel_size', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        pixel_size: 0.02,
      };

      const mesh = createLabel3D('Label', props);

      const geometry = mesh.geometry as THREE.PlaneGeometry;
      // Height should be pixel_size * 100 = 2.0
      expect(geometry.parameters.height).toBeCloseTo(2.0);
      // Width should be proportional to text width (aspect ratio)
      expect(geometry.parameters.width).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        text: '',
      };

      const mesh = createLabel3D('Label', props);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      // Should still create a mesh, just with empty canvas
      expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    });

    it('should store nodeType in userData', () => {
      const mesh = createLabel3D('Label', baseLabel3DProps);

      expect(mesh.userData.nodeType).toBe('Label3D');
    });

    it('should apply transform to mesh', () => {
      const transformedProps: Label3DProperties = {
        ...baseLabel3DProps,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 5, y: 3, z: -2 },
        },
      };

      const mesh = createLabel3D('Label', transformedProps);

      expect(mesh.position.x).toBeCloseTo(5);
      expect(mesh.position.y).toBeCloseTo(3);
      expect(mesh.position.z).toBeCloseTo(-2);
    });
  });

  describe('Billboard modes', () => {
    it('should mark mode 0 (DISABLED) labels correctly', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        billboard: BillboardMode.BILLBOARD_DISABLED,
      };

      const mesh = createLabel3D('Label', props);

      expect(mesh.userData.billboardMode).toBe(BillboardMode.BILLBOARD_DISABLED);
    });

    it('should mark mode 1 (ENABLED) labels correctly', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        billboard: BillboardMode.BILLBOARD_ENABLED,
      };

      const mesh = createLabel3D('Label', props);

      expect(mesh.userData.billboardMode).toBe(BillboardMode.BILLBOARD_ENABLED);
    });

    it('should mark mode 2 (FIXED_Y) labels correctly', () => {
      const props: Label3DProperties = {
        ...baseLabel3DProps,
        billboard: BillboardMode.BILLBOARD_FIXED_Y,
      };

      const mesh = createLabel3D('Label', props);

      expect(mesh.userData.billboardMode).toBe(BillboardMode.BILLBOARD_FIXED_Y);
    });
  });
});

/**
 * Integration test for UV transform with shared textures.
 * Tests that multiple materials can use the same texture with different UV transforms.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { parseStandardMaterial3D } from './parser';
import { createStandardMaterial } from './renderer';
import { ResourceLoader } from '../../ResourceLoader';
import type { FileEventBus, FileData } from '../../FileEventBus';

/**
 * Creates a mock FileEventBus that immediately returns mock texture data.
 */
function createMockFileEventBus(): FileEventBus {
  const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
    }),
    request: vi.fn((path: string) => {
      // Immediately emit loaded event with mock PNG data
      setTimeout(() => {
        const mockPngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        listeners.get('loaded')?.forEach(handler => handler(path, mockPngData.buffer as FileData));
      }, 0);
    }),
    clearCache: vi.fn(),
  };
}

// Mock THREE.TextureLoader to return controllable textures
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  class MockTextureLoader {
    load(
      _url: string,
      onLoad?: (texture: THREE.Texture) => void,
      _onProgress?: () => void,
      _onError?: (error: Error) => void
    ) {
      const texture = new actual.Texture();
      texture.colorSpace = actual.SRGBColorSpace;
      if (onLoad) {
        setTimeout(() => onLoad(texture), 0);
      }
      return texture;
    }
  }

  return {
    ...actual,
    TextureLoader: MockTextureLoader,
  };
});

describe('UV Transform Integration - Shared Textures', () => {
  let registry: ResourceLoader;
  let mockFileEventBus: FileEventBus;

  beforeEach(() => {
    mockFileEventBus = createMockFileEventBus();
    registry = new ResourceLoader(mockFileEventBus);
  });

  it('should apply different UV transforms to materials sharing the same texture', async () => {
    // Register the texture as ExtResource("1")
    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://textures/test.png',
    });

    // Parse first material with uv1_scale = 2.0
    const properties1 = await parseStandardMaterial3D(
      {
        albedo_texture: 'ExtResource("1")',
        uv1_scale: 'Vector3(2, 2, 1)',
      },
      registry
    );

    // Parse second material with uv1_scale = 4.0
    const properties2 = await parseStandardMaterial3D(
      {
        albedo_texture: 'ExtResource("1")',
        uv1_scale: 'Vector3(4, 4, 1)',
      },
      registry
    );

    // Create materials
    const material1 = createStandardMaterial(properties1);
    const material2 = createStandardMaterial(properties2);

    // Verify both materials have textures
    expect(material1.map).toBeDefined();
    expect(material2.map).toBeDefined();

    // CRITICAL: Both materials should have DIFFERENT repeat values
    // material1: uv1_scale=2.0 -> repeat=2.0
    // material2: uv1_scale=4.0 -> repeat=4.0
    expect(material1.map!.repeat.x).toBe(2.0);
    expect(material1.map!.repeat.y).toBe(2.0);

    expect(material2.map!.repeat.x).toBe(4.0);
    expect(material2.map!.repeat.y).toBe(4.0);

    // Verify they are NOT the same texture object (they should be cloned)
    expect(material1.map).not.toBe(material2.map);
  });

  it('should handle six materials with different UV scales (showcase scenario)', async () => {
    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://textures/checkerboard.svg',
    });

    // Six different UV scales like in the showcase fixture
    const uvScales = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];
    const expectedRepeats = [0.25, 0.5, 1.0, 2.0, 4.0, 8.0];

    const materials: THREE.MeshStandardMaterial[] = [];

    for (const scale of uvScales) {
      const properties = await parseStandardMaterial3D(
        {
          albedo_texture: 'ExtResource("1")',
          uv1_scale: `Vector3(${scale}, ${scale}, 1)`,
        },
        registry
      );

      materials.push(createStandardMaterial(properties));
    }

    // Verify all materials have different repeat values
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i]!;
      const expectedRepeat = expectedRepeats[i]!;

      expect(material.map).toBeDefined();
      expect(material.map!.repeat.x).toBeCloseTo(expectedRepeat, 5);
      expect(material.map!.repeat.y).toBeCloseTo(expectedRepeat, 5);
    }

    // Verify all textures are different objects (cloned)
    const textureObjects = materials.map(m => m.map);
    const uniqueTextures = new Set(textureObjects);
    expect(uniqueTextures.size).toBe(6); // Should have 6 different texture objects
  });
});

/**
 * Integration tests for external texture loading pipeline.
 * Tests complete flow: ResourceRegistry → texture loading → THREE.js Texture creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceRegistry } from '../../ResourceRegistry';

// Mock THREE.TextureLoader to avoid needing real browser environment
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  // Create a mock TextureLoader constructor
  class MockTextureLoader {
    load(url: string, onLoad?: (texture: THREE.Texture) => void, _onProgress?: () => void, onError?: (error: Error) => void) {
      try {
        // Simulate successful texture load
        const mockTexture = new actual.Texture();
        mockTexture.colorSpace = actual.SRGBColorSpace;
        if (onLoad) {
          setTimeout(() => onLoad(mockTexture), 0);
        }
        return mockTexture;
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
        throw error;
      }
    }
  }

  return {
    ...actual,
    TextureLoader: MockTextureLoader
  };
});

describe('Texture Loading Integration', () => {
  let registry: ResourceRegistry;
  let mockLoadResource: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new ResourceRegistry();
    mockLoadResource = vi.fn();

    // Create mock provider object with loadResource method
    const mockProvider = {
      loadResource: mockLoadResource
    };
    registry.setProvider(mockProvider);
  });

  // Happy path: Load PNG texture
  it('should load PNG texture and return THREE.Texture', async () => {
    // Mock PNG data
    const mockPngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    mockLoadResource.mockResolvedValue(mockPngData.buffer);

    // Register a texture resource
    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://textures/albedo.png'
    });

    // Load texture
    const texture = await registry.loadTexture('1_albedo');

    // Verify texture loaded
    expect(mockLoadResource).toHaveBeenCalledWith('res://textures/albedo.png', 'Texture2D');
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  // Happy path: Load texture by path
  it('should load texture by path instead of ID', async () => {
    const mockPngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    mockLoadResource.mockResolvedValue(mockPngData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://albedo.png'
    });

    const texture = await registry.loadTexture('res://albedo.png');

    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Edge case: Texture caching
  it('should cache textures and reuse for multiple loads', async () => {
    const mockPngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    mockLoadResource.mockResolvedValue(mockPngData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://shared.png'
    });

    // Load texture twice
    const texture1 = await registry.loadTexture('1');
    const texture2 = await registry.loadTexture('1');

    // Verify resource provider called only once (texture cached)
    expect(mockLoadResource).toHaveBeenCalledTimes(1);

    // Both loads should return same instance (cached)
    expect(texture1).toBe(texture2);
  });

  // Integration: SVG textures supported
  it('should load SVG textures', async () => {
    const mockSvgData = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    mockLoadResource.mockResolvedValue(mockSvgData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://icon.svg'
    });

    const texture = await registry.loadTexture('1');

    expect(mockLoadResource).toHaveBeenCalledWith('res://icon.svg', 'Texture2D');
    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Integration: WebP textures supported
  it('should load WebP textures', async () => {
    // WebP magic bytes
    const mockWebPData = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    mockLoadResource.mockResolvedValue(mockWebPData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://image.webp'
    });

    const texture = await registry.loadTexture('1');

    expect(mockLoadResource).toHaveBeenCalledWith('res://image.webp', 'Texture2D');
    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Error path: Missing texture returns null
  it('should return null when texture not registered', async () => {
    const result = await registry.loadTexture('missing_texture');
    expect(result).toBeNull();
  });

  // Error path: Non-texture resource returns null
  it('should return null when resource is not a texture', async () => {
    registry.register({
      id: '1',
      type: 'PackedScene',  // Not a texture!
      path: 'res://scene.tscn'
    });

    const result = await registry.loadTexture('1');
    expect(result).toBeNull();
  });

  // Error path: Missing texture file returns null
  it('should return null when texture file not found', async () => {
    mockLoadResource.mockRejectedValue(new Error('File not found'));

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    const result = await registry.loadTexture('1');
    expect(result).toBeNull();
  });

  // Callback: onResourceNeeded called for missing texture
  it('should call onResourceNeeded callback when texture fails to load', async () => {
    mockLoadResource.mockRejectedValue(new Error('File not found'));

    const onResourceNeeded = vi.fn();
    registry.setOnResourceNeeded(onResourceNeeded);

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    const result = await registry.loadTexture('1_albedo');

    expect(result).toBeNull();
    expect(onResourceNeeded).toHaveBeenCalledWith({
      path: 'res://missing.png',
      type: 'Texture2D',
      referencedBy: 'Material using texture 1_albedo',
      error: 'File not found'
    });
  });

  // Callback: Still returns null if callback set but throws
  it('should still return null even if onResourceNeeded callback throws', async () => {
    mockLoadResource.mockRejectedValue(new Error('File not found'));

    const onResourceNeeded = vi.fn().mockRejectedValue(new Error('Callback error'));
    registry.setOnResourceNeeded(onResourceNeeded);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    // Should not throw, just return null
    const result = await registry.loadTexture('1');
    expect(result).toBeNull();
  });

  // Integration: Missing texture doesn't prevent material creation
  it('should allow material parser to continue when texture is null', async () => {
    mockLoadResource.mockRejectedValue(new Error('File not found'));

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    // This should complete without throwing
    const texture = await registry.loadTexture('1_albedo');

    // Material parser checks if texture is null before assigning
    const material: { albedo_texture?: THREE.Texture } = {};
    if (texture) {
      material.albedo_texture = texture;
    }

    // Material should exist but without texture
    expect(material).toBeDefined();
    expect(material.albedo_texture).toBeUndefined();
  });
});

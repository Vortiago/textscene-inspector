/**
 * Integration tests for external texture loading pipeline.
 * Tests complete flow: ResourceLoader → texture loading → THREE.js Texture creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceLoader } from '../../ResourceLoader';
import type { FileEventBus, FileData } from '../../FileEventBus';

// Mock THREE.TextureLoader to avoid needing real browser environment
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  // Create a mock TextureLoader constructor
  class MockTextureLoader {
    load(_url: string, onLoad?: (texture: THREE.Texture) => void, _onProgress?: () => void, onError?: (error: Error) => void) {
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

/**
 * Creates a mock FileEventBus for testing.
 * Simulates file loading events without actual file system access.
 */
function createMockFileEventBus(): {
  fileEventBus: FileEventBus;
  simulateFileLoaded: (path: string, data: FileData) => void;
  simulateFileFailed: (path: string, error: Error) => void;
  setAutoLoad: (enabled: boolean, getData?: (path: string) => FileData | Promise<FileData>) => void;
} {
  const listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();
  const cache: Map<string, FileData> = new Map();
  let autoLoadEnabled = false;
  let autoLoadGetData: ((path: string) => FileData | Promise<FileData>) | undefined;

  // A behavioural double of the concrete class: only the surface the test
  // drives exists, so the cast is the honest statement of that.
  const fileEventBus = {
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
      // If auto-load is enabled, simulate file load
      if (autoLoadEnabled && autoLoadGetData) {
        setTimeout(async () => {
          try {
            const data = await autoLoadGetData!(path);
            cache.set(path, data);
            listeners.get('loaded')?.forEach(handler => handler(path, data));
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            listeners.get('failed')?.forEach(handler => handler(path, error));
          }
        }, 0);
      }
    }),
    clearCache: vi.fn((path?: string) => {
      if (path) {
        cache.delete(path);
      } else {
        cache.clear();
      }
    }),
  } as unknown as FileEventBus;

  return {
    fileEventBus,
    simulateFileLoaded: (path: string, data: FileData) => {
      cache.set(path, data);
      listeners.get('loaded')?.forEach(handler => handler(path, data));
    },
    simulateFileFailed: (path: string, error: Error) => {
      listeners.get('failed')?.forEach(handler => handler(path, error));
    },
    setAutoLoad: (enabled: boolean, getData?: (path: string) => FileData | Promise<FileData>) => {
      autoLoadEnabled = enabled;
      autoLoadGetData = getData;
    },
  };
}

/**
 * Helper to load texture using event-based API.
 */
async function loadTextureWithEvents(
  registry: ResourceLoader,
  idOrPath: string
): Promise<THREE.Texture | null> {
  const metadata = registry.getMetadata(idOrPath);
  if (!metadata) {
    return null;
  }

  // Check if it's a texture type
  const textureTypes = ['Texture2D', 'CompressedTexture2D', 'ImageTexture'];
  if (!textureTypes.includes(metadata.type)) {
    return null;
  }

  const path = metadata.path;

  // Check cache first
  const cached = registry.textures.getCached(path);
  if (cached !== undefined) {
    return cached;
  }

  // Request and wait for event
  registry.textures.request(path);
  try {
    return await registry.eventBus.once<THREE.Texture>('texture', 'loaded', path);
  } catch {
    return null;
  }
}

describe('Texture Loading Integration', () => {
  let registry: ResourceLoader;
  let mockFileEventBus: ReturnType<typeof createMockFileEventBus>;

  beforeEach(() => {
    mockFileEventBus = createMockFileEventBus();
    registry = new ResourceLoader(mockFileEventBus.fileEventBus);
  });

  // Happy path: Load PNG texture
  it('should load PNG texture and return THREE.Texture', async () => {
    // Mock PNG data
    const mockPngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    mockFileEventBus.setAutoLoad(true, () => mockPngData.buffer);

    // Register a texture resource
    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://textures/albedo.png'
    });

    // Load texture using event-based API
    const texture = await loadTextureWithEvents(registry, '1_albedo');

    // Verify texture loaded
    expect(mockFileEventBus.fileEventBus.request).toHaveBeenCalledWith('res://textures/albedo.png');
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture!.colorSpace).toBe(THREE.SRGBColorSpace);
  });

  // Happy path: Load texture by path
  it('should load texture by path instead of ID', async () => {
    const mockPngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    mockFileEventBus.setAutoLoad(true, () => mockPngData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://albedo.png'
    });

    const texture = await loadTextureWithEvents(registry, 'res://albedo.png');

    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Edge case: Texture caching
  it('should cache textures and reuse for multiple loads', async () => {
    const mockPngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    let loadCount = 0;
    mockFileEventBus.setAutoLoad(true, () => {
      loadCount++;
      return mockPngData.buffer;
    });

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://shared.png'
    });

    // Load texture twice
    const texture1 = await loadTextureWithEvents(registry, '1');
    const texture2 = await loadTextureWithEvents(registry, '1');

    // Verify FileEventBus request called only once (texture cached)
    expect(loadCount).toBe(1);

    // Both loads should return same instance (cached)
    expect(texture1).toBe(texture2);
  });

  // Integration: SVG textures supported
  it('should load SVG textures', async () => {
    const mockSvgData = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    mockFileEventBus.setAutoLoad(true, () => mockSvgData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://icon.svg'
    });

    const texture = await loadTextureWithEvents(registry, '1');

    expect(mockFileEventBus.fileEventBus.request).toHaveBeenCalledWith('res://icon.svg');
    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Integration: WebP textures supported
  it('should load WebP textures', async () => {
    // WebP magic bytes
    const mockWebPData = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    mockFileEventBus.setAutoLoad(true, () => mockWebPData.buffer);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://image.webp'
    });

    const texture = await loadTextureWithEvents(registry, '1');

    expect(mockFileEventBus.fileEventBus.request).toHaveBeenCalledWith('res://image.webp');
    expect(texture).toBeInstanceOf(THREE.Texture);
  });

  // Error path: Missing texture returns null
  it('should return null when texture not registered', async () => {
    const result = await loadTextureWithEvents(registry, 'missing_texture');
    expect(result).toBeNull();
  });

  // Error path: Non-texture resource returns null
  it('should return null when resource is not a texture', async () => {
    registry.register({
      id: '1',
      type: 'PackedScene',  // Not a texture!
      path: 'res://scene.tscn'
    });

    const result = await loadTextureWithEvents(registry, '1');
    expect(result).toBeNull();
  });

  // Error path: Missing texture file returns null
  it('should return null when texture file not found', async () => {
    mockFileEventBus.setAutoLoad(true, () => {
      throw new Error('File not found');
    });

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    const result = await loadTextureWithEvents(registry, '1');
    expect(result).toBeNull();
  });

  // Callback: onResourceNeeded called for missing texture
  it('should call onResourceNeeded callback when texture fails to load', async () => {
    mockFileEventBus.setAutoLoad(true, () => {
      throw new Error('File not found');
    });

    const onResourceNeeded = vi.fn();
    registry.setOnResourceNeeded(onResourceNeeded);

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    const result = await loadTextureWithEvents(registry, '1_albedo');

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
    mockFileEventBus.setAutoLoad(true, () => {
      throw new Error('File not found');
    });

    const onResourceNeeded = vi.fn().mockImplementation(() => {
      throw new Error('Callback error');
    });
    registry.setOnResourceNeeded(onResourceNeeded);

    registry.register({
      id: '1',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    // Should not throw, just return null
    const result = await loadTextureWithEvents(registry, '1');
    expect(result).toBeNull();
  });

  // Integration: Missing texture doesn't prevent material creation
  it('should allow material parser to continue when texture is null', async () => {
    mockFileEventBus.setAutoLoad(true, () => {
      throw new Error('File not found');
    });

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    // This should complete without throwing
    const texture = await loadTextureWithEvents(registry, '1_albedo');

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

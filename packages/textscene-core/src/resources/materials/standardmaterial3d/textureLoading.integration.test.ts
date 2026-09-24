/** The external texture pipeline end to end: ResourceLoader, texture load, THREE Texture. */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceLoader } from '../../ResourceLoader';
import type { FileEventBus, FileData } from '../../FileEventBus';

// A mock THREE.TextureLoader, so the test needs no browser.
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  class MockTextureLoader {
    load(_url: string, onLoad?: (texture: THREE.Texture) => void, _onProgress?: () => void, onError?: (error: Error) => void) {
      try {
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

/** A FileEventBus that answers load requests without touching the file system. */
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

  const textureTypes = ['Texture2D', 'CompressedTexture2D', 'ImageTexture'];
  if (!textureTypes.includes(metadata.type)) {
    return null;
  }

  const path = metadata.path;

  const cached = registry.textures.getCached(path);
  if (cached !== undefined) {
    return cached;
  }

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

  it('should load PNG texture and return THREE.Texture', async () => {
    const mockPngData = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    mockFileEventBus.setAutoLoad(true, () => mockPngData.buffer);

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://textures/albedo.png'
    });

    const texture = await loadTextureWithEvents(registry, '1_albedo');

    expect(mockFileEventBus.fileEventBus.request).toHaveBeenCalledWith('res://textures/albedo.png');
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture!.colorSpace).toBe(THREE.SRGBColorSpace);
  });

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

    const texture1 = await loadTextureWithEvents(registry, '1');
    const texture2 = await loadTextureWithEvents(registry, '1');

    expect(loadCount).toBe(1);

    expect(texture1).toBe(texture2);
  });

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

  it('should return null when texture not registered', async () => {
    const result = await loadTextureWithEvents(registry, 'missing_texture');
    expect(result).toBeNull();
  });

  it('should return null when resource is not a texture', async () => {
    registry.register({
      id: '1',
      type: 'PackedScene',  // Not a texture!
      path: 'res://scene.tscn'
    });

    const result = await loadTextureWithEvents(registry, '1');
    expect(result).toBeNull();
  });

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

    const result = await loadTextureWithEvents(registry, '1');
    expect(result).toBeNull();
  });

  it('should allow material parser to continue when texture is null', async () => {
    mockFileEventBus.setAutoLoad(true, () => {
      throw new Error('File not found');
    });

    registry.register({
      id: '1_albedo',
      type: 'Texture2D',
      path: 'res://missing.png'
    });

    const texture = await loadTextureWithEvents(registry, '1_albedo');

    // Material parser checks if texture is null before assigning
    const material: { albedo_texture?: THREE.Texture } = {};
    if (texture) {
      material.albedo_texture = texture;
    }

    expect(material).toBeDefined();
    expect(material.albedo_texture).toBeUndefined();
  });
});

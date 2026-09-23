import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebResourceProvider } from './WebResourceProvider';

describe('WebResourceProvider', () => {
  let provider: WebResourceProvider;

  beforeEach(() => {
    provider = new WebResourceProvider();
    vi.clearAllMocks();
  });

  describe('loadResource - uploaded files', () => {
    // Happy path: Text resource
    it('should load text resource from uploaded files', async () => {
      const tscnContent = '[gd_scene format=3]\n[node name="Test" type="Node3D"]';
      const mockFile = new File([tscnContent], 'test.tscn', { type: 'text/plain' });

      provider.addUploadedFile('res://test.tscn', mockFile);

      const content = await provider.loadResource('res://test.tscn', 'PackedScene');

      expect(typeof content).toBe('string');
      expect(content).toBe(tscnContent);
    });

    // Happy path: Binary resource
    it('should load binary resource as ArrayBuffer from uploaded files', async () => {
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG header
      const mockFile = new File([binaryData], 'icon.png', { type: 'image/png' });

      provider.addUploadedFile('res://textures/icon.png', mockFile);

      const content = await provider.loadResource('res://textures/icon.png', 'Texture2D');

      expect(content).toBeInstanceOf(ArrayBuffer);
      const result = new Uint8Array(content as ArrayBuffer);
      expect(result[0]).toBe(0x89);
      expect(result[1]).toBe(0x50);
    });

    // Edge case: Empty file
    it('should load empty file without error', async () => {
      const mockFile = new File([''], 'empty.tscn');
      provider.addUploadedFile('res://empty.tscn', mockFile);

      const content = await provider.loadResource('res://empty.tscn', 'PackedScene');

      expect(content).toBe('');
    });
  });

  describe('loadResource - fixture fallback', () => {
    // Happy path: Fetch from fixtures
    it('should fetch external scene from /fixtures/ when res:// prefix', async () => {
      const tscnContent = '[gd_scene format=3]\n[node name="Child" type="Node3D"]';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => tscnContent
      } as Response);

      const content = await provider.loadResource('res://child_cube.tscn', 'PackedScene');

      expect(global.fetch).toHaveBeenCalledWith('/fixtures/child_cube.tscn');
      expect(content).toBe(tscnContent);
    });

    // Vendored demo corpora live under a per-project subtree; the active
    // root scopes every res:// lookup to that project's namespace.
    it('resolves res:// under the active resource root and resets with it', async () => {
      const tscnContent = '[gd_scene format=3]';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
        },
        text: async () => tscnContent,
      } as Response);

      provider.setResourceRoot('demos/2d/platformer');
      await provider.loadResource('res://scenes/player.tscn', 'PackedScene');
      expect(global.fetch).toHaveBeenCalledWith('/fixtures/demos/2d/platformer/scenes/player.tscn');

      provider.setResourceRoot('');
      await provider.loadResource('res://scenes/player.tscn', 'PackedScene');
      expect(global.fetch).toHaveBeenLastCalledWith('/fixtures/scenes/player.tscn');
    });

    // Edge case: Nested paths
    it('should handle nested paths (res://scenes/Door.tscn → /fixtures/scenes/Door.tscn)', async () => {
      const tscnContent = '[gd_scene format=3]';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        },
        text: async () => tscnContent
      } as Response);

      await provider.loadResource('res://scenes/Door.tscn', 'PackedScene');

      expect(global.fetch).toHaveBeenCalledWith('/fixtures/scenes/Door.tscn');
    });

    // Error path: Fetch returns 404
    it('should throw when fetch returns 404', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      await expect(
        provider.loadResource('res://missing.tscn', 'PackedScene')
      ).rejects.toThrow('Resource not found: res://missing.tscn');
    });

    // Error path: Fetch returns 500
    it('should throw when fetch returns 500', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(
        provider.loadResource('res://error.tscn', 'PackedScene')
      ).rejects.toThrow('Resource not found');
    });

    // Error path: Network error
    it('should throw when fetch fails with network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        provider.loadResource('res://network-fail.tscn', 'PackedScene')
      ).rejects.toThrow('Resource not found');
    });

    // Edge case: Fetch returns HTML fallback (SPA behavior for missing files)
    it('should detect HTML fallback and throw error', async () => {
      const htmlError = '<html><body>404 Not Found</body></html>';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/html' : null
        },
        text: async () => htmlError
      } as Response);

      await expect(
        provider.loadResource('res://fake.tscn', 'PackedScene')
      ).rejects.toThrow('Resource not found');
    });

    // Integration: Uploaded files prioritized over fixture fetch
    it('should prioritize uploaded files over fixture fetch', async () => {
      const uploadedContent = '[gd_scene format=3]\n[node name="Uploaded" type="Node3D"]';
      const mockFile = new File([uploadedContent], 'test.tscn');
      provider.addUploadedFile('res://test.tscn', mockFile);

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const content = await provider.loadResource('res://test.tscn', 'PackedScene');

      expect(content).toBe(uploadedContent);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('addUploadedFile', () => {
    // State change: File added and loadable
    it('should add file so it can be loaded by path', async () => {
      const content = '[gd_scene format=3]';
      const mockFile = new File([content], 'test.tscn');

      provider.addUploadedFile('res://test.tscn', mockFile);

      const result = await provider.loadResource('res://test.tscn', 'PackedScene');
      expect(result).toBe(content);
    });

    // Edge case: Replace existing file
    it('should replace existing file with same path', async () => {
      const file1 = new File(['content1'], 'test.tscn');
      const file2 = new File(['content2'], 'test.tscn');

      provider.addUploadedFile('res://test.tscn', file1);
      provider.addUploadedFile('res://test.tscn', file2);

      const result = await provider.loadResource('res://test.tscn', 'PackedScene');
      expect(result).toBe('content2');
    });

    // Edge case: Multiple different files
    it('should track multiple files with different paths', async () => {
      const file1 = new File(['content1'], 'file1.tscn');
      const file2 = new File(['content2'], 'file2.tscn');

      provider.addUploadedFile('res://file1.tscn', file1);
      provider.addUploadedFile('res://file2.tscn', file2);

      const [r1, r2] = await Promise.all([
        provider.loadResource('res://file1.tscn', 'PackedScene'),
        provider.loadResource('res://file2.tscn', 'PackedScene'),
      ]);
      expect(r1).toBe('content1');
      expect(r2).toBe('content2');
    });
  });

  describe('error handling', () => {
    // Error path: Resource not found anywhere
    it('should throw when resource not in uploaded files and not in fixtures', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false
      } as Response);

      await expect(
        provider.loadResource('res://nowhere.tscn', 'PackedScene')
      ).rejects.toThrow('Resource not found');
    });

    // Error path: All resource types attempt fetch from fixtures
    it('should attempt fetch for all resource types from fixtures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      } as Response);

      await expect(
        provider.loadResource('res://texture.png', 'Texture2D')
      ).rejects.toThrow('Resource not found');

      expect(global.fetch).toHaveBeenCalledWith('/fixtures/texture.png');
    });
  });
});

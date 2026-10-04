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
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
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
          get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
        },
        text: async () => tscnContent,
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
          get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
        },
        text: async () => tscnContent,
      } as Response);

      await provider.loadResource('res://scenes/Door.tscn', 'PackedScene');

      expect(global.fetch).toHaveBeenCalledWith('/fixtures/scenes/Door.tscn');
    });

    // Miss path: Fetch returns 404
    it('answers null when the mirror answers 404', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(provider.loadResource('res://missing.tscn', 'PackedScene')).resolves.toBeNull();
    });

    // Miss path: Fetch returns 500
    it('answers null when the mirror refuses the file', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(provider.loadResource('res://error.tscn', 'PackedScene')).resolves.toBeNull();
    });

    // Failure path: Network error, which is not a miss
    it('propagates a fetch that fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(provider.loadResource('res://network-fail.tscn', 'PackedScene')).rejects.toThrow(
        'Network error'
      );
    });

    // Miss path: Fetch returns HTML fallback (SPA behavior for missing files)
    it('treats the HTML fallback as a miss', async () => {
      const htmlError = '<html><body>404 Not Found</body></html>';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: async () => htmlError,
      } as Response);

      await expect(provider.loadResource('res://fake.tscn', 'PackedScene')).resolves.toBeNull();
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

  describe('loadResource - without a fixtures mirror', () => {
    beforeEach(() => {
      provider = new WebResourceProvider({ hasFixturesMirror: false });
    });

    it('serves an uploaded file', async () => {
      provider.addUploadedFile('res://door.tscn', new File(['[gd_scene]'], 'door.tscn'));

      await expect(provider.loadResource('res://door.tscn', 'PackedScene')).resolves.toBe('[gd_scene]');
    });

    it('answers null for a missing res:// path without a request', async () => {
      await expect(provider.loadResource('res://door.tscn', 'PackedScene')).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('answers null for a path without the res:// prefix', async () => {
      await expect(provider.loadResource('door.tscn', 'PackedScene')).resolves.toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
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
    // Miss path: neither uploaded nor in the fixtures
    it('answers null when the resource is neither uploaded nor in the fixtures', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(provider.loadResource('res://nowhere.tscn', 'PackedScene')).resolves.toBeNull();
    });

    // Miss path: All resource types attempt fetch from fixtures
    it('should attempt fetch for all resource types from fixtures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(provider.loadResource('res://texture.png', 'Texture2D')).resolves.toBeNull();

      expect(global.fetch).toHaveBeenCalledWith('/fixtures/texture.png');
    });
  });

  describe('stamp', () => {
    it('stamps an uploaded file, and a new upload at the same path differently', async () => {
      provider.addUploadedFile('res://tree.glb', new File(['a'], 'tree.glb'));
      const first = await provider.stamp('res://tree.glb');
      provider.addUploadedFile('res://tree.glb', new File(['a'], 'tree.glb'));

      expect(first).not.toBeNull();
      expect(await provider.stamp('res://tree.glb')).not.toBe(first);
    });

    it('changes the stamp when an upload is removed and the path falls back to the mirror', async () => {
      provider.addUploadedFile('res://tree.glb', new File(['a'], 'tree.glb'));
      const uploaded = await provider.stamp('res://tree.glb');
      provider.removeUploadedFile('res://tree.glb');

      expect(await provider.stamp('res://tree.glb')).not.toBe(uploaded);
    });

    it('gives no stamp for a mirrored file no fetch has delivered, and fetches nothing', async () => {
      expect(await provider.stamp('res://tree.glb')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('gives no stamp for a mirrored file whose fetch failed', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
      await expect(provider.loadResource('res://tree.glb', 'PackedScene')).rejects.toThrow();

      expect(await provider.stamp('res://tree.glb')).toBeNull();
    });

    it('gives no stamp for a mirrored file the site answered with its HTML fallback', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mirrorResponse('<html></html>', 'text/html')
      );
      await expect(provider.loadResource('res://tree.glb', 'PackedScene')).resolves.toBeNull();

      expect(await provider.stamp('res://tree.glb')).toBeNull();
    });

    it('stamps a mirrored file once a fetch delivered it, by the corpus root it resolves under', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mirrorResponse('glb'));
      await provider.loadResource('res://tree.glb', 'PackedScene');
      const atRoot = await provider.stamp('res://tree.glb');
      provider.setResourceRoot('demos/3d/truck_town');
      await provider.loadResource('res://tree.glb', 'PackedScene');

      expect(atRoot).not.toBeNull();
      expect(await provider.stamp('res://tree.glb')).not.toBe(atRoot);
      expect(await provider.stamp('res://tree.glb')).toBe(await provider.stamp('res://tree.glb'));
    });

    it('keeps no stamp for a root whose fetch has not delivered the file', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mirrorResponse('glb'));
      await provider.loadResource('res://tree.glb', 'PackedScene');
      provider.setResourceRoot('demos/3d/truck_town');

      expect(await provider.stamp('res://tree.glb')).toBeNull();
    });

    it('stamps an upload only under the corpus root it was added in', async () => {
      provider.addUploadedFile('res://tree.glb', new File(['a'], 'tree.glb'));
      const uploaded = await provider.stamp('res://tree.glb');
      provider.setResourceRoot('demos/3d/truck_town');

      expect(await provider.stamp('res://tree.glb')).not.toBe(uploaded);
    });
  });
});

/** A successful mirror response holding `body`, served as `contentType`. */
function mirrorResponse(body: string, contentType = 'application/octet-stream') {
  return {
    ok: true,
    headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

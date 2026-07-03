/**
 * Tests for VSCodeResourceProvider
 * Validates workspace resource loading, path resolution, and security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VSCodeResourceProvider } from './VSCodeResourceProvider';
import { createMockUri, createMockFileData, vscode } from '../test-setup';

describe('VSCodeResourceProvider', () => {
  let provider: VSCodeResourceProvider;
  let workspaceRoot: ReturnType<typeof createMockUri>;
  let documentUri: ReturnType<typeof createMockUri>;

  beforeEach(() => {
    workspaceRoot = createMockUri('/workspace');
    documentUri = createMockUri('/workspace/scenes/test.tscn');
    provider = new VSCodeResourceProvider(workspaceRoot, documentUri);

    // Mock project.godot search - simulate finding it at workspace root
    vscode.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
      const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
      if (path.endsWith('project.godot') && path.startsWith('/workspace/project.godot')) {
        return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 100 });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  // ============================================================================
  // Path Resolution Tests
  // ============================================================================

  describe('Path Resolution', () => {
    it('should resolve res:// path to workspace root', async () => {
      const tscnContent = '[gd_scene format=3]\n[node name="Door" type="Node3D"]';
      const mockData = createMockFileData(tscnContent);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      const result = await provider.loadResource('res://scenes/Door.tscn', 'PackedScene');

      expect(result).toBe(tscnContent);
      expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
    });

    it('should resolve nested directory paths correctly', async () => {
      const content = 'texture data';
      const mockData = createMockFileData(content);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      const result = await provider.loadResource('res://assets/textures/wood/oak.png', 'Texture2D');

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
    });

    it('resolves res:// from the workspace root for a subdir scene when no project.godot exists', async () => {
      // res:// is ALWAYS project-root-relative in Godot. With no project.godot to
      // anchor on, the provider must fall back to the workspace root — NOT the
      // scene's own folder. Regression: a scene in Scenes/Hallway/ used to resolve
      // res://assets/X.glb to Scenes/Hallway/assets/X.glb, so every GLB 404'd.
      vscode.workspace.fs.stat.mockRejectedValue(new Error('Not found')); // no project.godot anywhere
      const subdirDoc = createMockUri('/workspace/Scenes/Hallway/Hallway.tscn');
      const subdirProvider = new VSCodeResourceProvider(workspaceRoot, subdirDoc);

      let readUri: ReturnType<typeof createMockUri> | undefined;
      vscode.workspace.fs.readFile.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
        readUri = uri;
        return Promise.resolve(createMockFileData('glb-bytes'));
      });

      await subdirProvider.loadResource('res://assets/PortraitFrame2.glb', 'PackedScene');

      expect(readUri?.fsPath.replace(/\\/g, '/')).toBe('/workspace/assets/PortraitFrame2.glb');
    });

    it('should prevent path traversal attacks', async () => {
      const maliciousPath = 'res://../../../etc/passwd';

      await expect(
        provider.loadResource(maliciousPath, 'PackedScene')
      ).rejects.toThrow(/Path traversal detected/);
    });

    it('should handle paths without res:// prefix', async () => {
      const content = 'shader code';
      const mockData = createMockFileData(content);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      const result = await provider.loadResource('shaders/custom.gdshader', 'Shader');

      expect(typeof result).toBe('string');
      expect(result).toBe(content);
    });
  });

  // ============================================================================
  // File Loading Tests
  // ============================================================================

  describe('File Loading', () => {
    it('should load text resource as string', async () => {
      const tscnContent = '[gd_scene format=3]\n[node name="Test" type="Node3D"]';
      const mockData = createMockFileData(tscnContent);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      const result = await provider.loadResource('res://test.tscn', 'PackedScene');

      expect(typeof result).toBe('string');
      expect(result).toBe(tscnContent);
    });

    it('should load binary resource as ArrayBuffer', async () => {
      // Simulate binary image data (PNG header)
      const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(binaryData);

      const result = await provider.loadResource('res://icon.png', 'Texture2D');

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect((result as ArrayBuffer).byteLength).toBe(8);

      // Verify contents match
      const resultView = new Uint8Array(result as ArrayBuffer);
      expect(Array.from(resultView)).toEqual(Array.from(binaryData));
    });

    it('should throw error when file does not exist', async () => {
      const notFoundError = new Error('File not found');
      // Reject both primary and fallback attempts
      vscode.workspace.fs.readFile.mockRejectedValue(notFoundError);

      await expect(
        provider.loadResource('res://missing.tscn', 'PackedScene')
      ).rejects.toThrow(/Failed to load resource.*missing\.tscn/);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      const emptyData = createMockFileData('');

      vscode.workspace.fs.readFile.mockResolvedValueOnce(emptyData);

      const result = await provider.loadResource('res://empty.tscn', 'PackedScene');

      expect(typeof result).toBe('string');
      expect(result).toBe('');
    });

    it('should handle file read permission errors', async () => {
      const permissionError = new Error('EACCES: permission denied');
      // Reject both primary and fallback attempts
      vscode.workspace.fs.readFile.mockRejectedValue(permissionError);

      await expect(
        provider.loadResource('res://protected.tscn', 'PackedScene')
      ).rejects.toThrow(/Failed to load resource.*protected\.tscn/);
    });

    it('should handle paths with special characters', async () => {
      const content = 'scene content';
      const mockData = createMockFileData(content);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      // Spaces, hyphens, underscores
      const result = await provider.loadResource('res://my scenes/door-v2_final.tscn', 'PackedScene');

      expect(typeof result).toBe('string');
      expect(result).toBe(content);
    });
  });

  // ============================================================================
  // Served Resource Tracking (fsPath -> res:// round-trip for hot-reload)
  // ============================================================================

  describe('Served Resource Tracking', () => {
    it('returns null for a file that was never loaded through this provider', () => {
      const resPath = provider.getServedResPath(createMockUri('/workspace/textures/wood.png'));

      expect(resPath).toBeNull();
    });

    it('records the exact res:// string served for a resource resolved via the project-root branch', async () => {
      vscode.workspace.fs.readFile.mockResolvedValueOnce(createMockFileData('texture data'));

      await provider.loadResource('res://textures/wood.png', 'Texture2D');

      const resPath = provider.getServedResPath(createMockUri('/workspace/textures/wood.png'));
      expect(resPath).toBe('res://textures/wood.png');
    });

    it('matches a served resource regardless of fsPath casing (case-insensitive filesystem)', async () => {
      vscode.workspace.fs.readFile.mockResolvedValueOnce(createMockFileData('texture data'));

      // Requested with mixed case; the watcher later reports the on-disk path lowercased.
      await provider.loadResource('res://Textures/Wood.png', 'Texture2D');

      const resPath = provider.getServedResPath(createMockUri('/workspace/textures/wood.png'));
      // The original served string, not a re-derivation from the lowercase watcher path.
      expect(resPath).toBe('res://Textures/Wood.png');
    });

    it('records the fallback-resolved fsPath (document-dir relative) so it round-trips on later invalidation', async () => {
      // Primary (project-root-relative) resolution fails; only the document-dir
      // fallback succeeds. documentUri is /workspace/scenes/test.tscn, so the
      // fallback path is /workspace/scenes/icon.png.
      vscode.workspace.fs.readFile.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
        if (uri.fsPath.replace(/\\/g, '/') === '/workspace/scenes/icon.png') {
          return Promise.resolve(createMockFileData('icon-bytes'));
        }
        return Promise.reject(new Error('Not found'));
      });

      await provider.loadResource('res://icon.png', 'Texture2D');

      const resPath = provider.getServedResPath(createMockUri('/workspace/scenes/icon.png'));
      expect(resPath).toBe('res://icon.png');
    });

    it('records a resolved candidate even when the read fails, so a later on-disk creation can still be matched', async () => {
      vscode.workspace.fs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(provider.loadResource('res://textures/missing.png', 'Texture2D')).rejects.toThrow();

      const resPath = provider.getServedResPath(createMockUri('/workspace/textures/missing.png'));
      expect(resPath).toBe('res://textures/missing.png');
    });

    it('matches a served resource looked up with Windows-style backslash separators', async () => {
      vscode.workspace.fs.readFile.mockResolvedValueOnce(createMockFileData('texture data'));

      await provider.loadResource('res://textures/wood.png', 'Texture2D');

      // The watcher (or a caller building a raw OS path) may report the same
      // file with backslash separators instead of the forward slashes the
      // provider's own Uri.joinPath resolution produced internally.
      const resPath = provider.getServedResPath(createMockUri('/workspace\\textures\\wood.png'));
      expect(resPath).toBe('res://textures/wood.png');
    });
  });
});

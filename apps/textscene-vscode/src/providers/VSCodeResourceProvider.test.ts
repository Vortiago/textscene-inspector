/**
 * Tests for VSCodeResourceProvider
 * Validates workspace resource loading, path resolution, and security
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VSCodeResourceProvider } from './VSCodeResourceProvider';
import { createMockUri, createMockFileData, vscode } from '../test-setup';

describe('VSCodeResourceProvider', () => {
  let provider: VSCodeResourceProvider;
  let workspaceRoot: ReturnType<typeof createMockUri>;
  let documentUri: ReturnType<typeof createMockUri>;

  beforeEach(() => {
    workspaceRoot = createMockUri('/workspace');
    documentUri = createMockUri('/workspace/test.tscn');
    provider = new VSCodeResourceProvider(workspaceRoot, documentUri);
  });

  // ============================================================================
  // Path Resolution Tests
  // ============================================================================

  describe('Path Resolution', () => {
    it('should resolve res:// path to workspace root', async () => {
      const tscnContent = '[gd_scene format=3]\n[node name="Door" type="Node3D"]';
      const mockData = createMockFileData(tscnContent);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      await provider.loadResource('res://scenes/Door.tscn', 'PackedScene');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        workspaceRoot,
        'scenes/Door.tscn'
      );
    });

    it('should resolve nested directory paths correctly', async () => {
      const content = 'texture data';
      const mockData = createMockFileData(content);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      await provider.loadResource('res://assets/textures/wood/oak.png', 'Texture2D');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        workspaceRoot,
        'assets/textures/wood/oak.png'
      );
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

      await provider.loadResource('shaders/custom.gdshader', 'Shader');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        workspaceRoot,
        'shaders/custom.gdshader'
      );
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
      vscode.workspace.fs.readFile.mockRejectedValueOnce(notFoundError);

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
      vscode.workspace.fs.readFile.mockRejectedValueOnce(permissionError);

      await expect(
        provider.loadResource('res://protected.tscn', 'PackedScene')
      ).rejects.toThrow(/Failed to load resource.*protected\.tscn/);
    });

    it('should handle paths with special characters', async () => {
      const content = 'scene content';
      const mockData = createMockFileData(content);

      vscode.workspace.fs.readFile.mockResolvedValueOnce(mockData);

      // Spaces, hyphens, underscores
      await provider.loadResource('res://my scenes/door-v2_final.tscn', 'PackedScene');

      expect(vscode.Uri.joinPath).toHaveBeenCalledWith(
        workspaceRoot,
        'my scenes/door-v2_final.tscn'
      );
    });
  });
});

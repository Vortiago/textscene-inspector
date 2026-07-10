/**
 * Tests for TscnDocumentLinkProvider: turns `res://` references in a `.tscn`
 * document into clickable links. `provideDocumentLinks` only computes ranges
 * (cheap, synchronous, no IO); `resolveDocumentLink` fills in the target Uri
 * lazily — only for the link the user actually hovers/clicks — by walking up
 * for `project.godot` via the shared `findGodotProjectRoot` helper.
 */

import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnDocumentLinkProvider } from './TscnDocumentLinkProvider';
import { createMockUri, vscode as vscodeMocks } from './test-setup';

function makeDocument(content: string, fsPath = '/workspace/scenes/Door.tscn'): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    uri: createMockUri(fsPath),
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  } as unknown as vscode.TextDocument;
}

const TOKEN = {} as vscode.CancellationToken;

describe('TscnDocumentLinkProvider', () => {
  describe('provideDocumentLinks', () => {
    it('returns no links for a document with no res:// references', () => {
      const provider = new TscnDocumentLinkProvider();
      const document = makeDocument('[gd_scene format=3]\n[node name="Root" type="Node3D"]');

      const links = provider.provideDocumentLinks(document, TOKEN);

      expect(links).toEqual([]);
    });

    it('finds a single res:// reference and ranges exactly over it', () => {
      const provider = new TscnDocumentLinkProvider();
      const line = '[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="1"]';
      const document = makeDocument(line);

      const links = provider.provideDocumentLinks(document, TOKEN) as ReturnType<
        TscnDocumentLinkProvider['provideDocumentLinks']
      > & Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } } }>;

      expect(links).toHaveLength(1);
      const expectedStart = line.indexOf('res://');
      expect(links[0]!.range.start.line).toBe(0);
      expect(links[0]!.range.start.character).toBe(expectedStart);
      expect(links[0]!.range.end.character).toBe(expectedStart + 'res://scenes/Door.tscn'.length);
    });

    it('finds multiple res:// references across multiple lines', () => {
      const provider = new TscnDocumentLinkProvider();
      const content = [
        '[ext_resource type="PackedScene" path="res://scenes/Door.tscn" id="1"]',
        '[ext_resource type="Texture2D" path="res://assets/wood.png" id="2"]',
      ].join('\n');
      const document = makeDocument(content);

      const links = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<{
        range: { start: { line: number } };
      }>;

      expect(links).toHaveLength(2);
      expect(links[0]!.range.start.line).toBe(0);
      expect(links[1]!.range.start.line).toBe(1);
    });

    it('finds multiple res:// references on the same line', () => {
      const provider = new TscnDocumentLinkProvider();
      const line = 'sources = PackedStringArray("res://a.png", "res://b.png")';
      const document = makeDocument(line);

      const links = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<{
        range: { start: { character: number }; end: { character: number } };
      }>;

      expect(links).toHaveLength(2);
      // Neither link swallows the closing quote/paren/comma that follows it.
      expect(line.slice(links[0]!.range.start.character, links[0]!.range.end.character)).toBe(
        'res://a.png'
      );
      expect(line.slice(links[1]!.range.start.character, links[1]!.range.end.character)).toBe(
        'res://b.png'
      );
    });
  });

  describe('resolveDocumentLink', () => {
    it('resolves the target relative to the workspace root when no project.godot exists', async () => {
      const workspaceRoot = createMockUri('/workspace');
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: workspaceRoot,
      });
      vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

      const provider = new TscnDocumentLinkProvider();
      const line = 'path="res://scenes/Door.tscn"';
      const document = makeDocument(line);
      const [link] = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;

      const resolved = await provider.resolveDocumentLink!(link!, TOKEN);

      expect(resolved).toBeDefined();
      expect((resolved!.target as unknown as { fsPath: string }).fsPath).toBe(
        '/workspace/scenes/Door.tscn'
      );
    });

    it('resolves the target relative to a project.godot found above the document', async () => {
      const workspaceRoot = createMockUri('/workspace');
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: workspaceRoot,
      });
      vscodeMocks.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
        const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
        if (path === '/workspace/game/project.godot') {
          return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
        }
        return Promise.reject(new Error('Not found'));
      });

      const provider = new TscnDocumentLinkProvider();
      const line = 'path="res://scenes/Door.tscn"';
      const document = makeDocument(line, '/workspace/game/scenes/Door.tscn');
      const [link] = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;

      const resolved = await provider.resolveDocumentLink!(link!, TOKEN);

      expect((resolved!.target as unknown as { fsPath: string }).fsPath).toBe(
        '/workspace/game/scenes/Door.tscn'
      );
    });

    it('leaves the target unresolved when the document has no workspace folder', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(
        undefined
      );

      const provider = new TscnDocumentLinkProvider();
      const line = 'path="res://scenes/Door.tscn"';
      const document = makeDocument(line);
      const [link] = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;

      const resolved = await provider.resolveDocumentLink!(link!, TOKEN);

      expect(resolved).toBeUndefined();
    });
  });
});

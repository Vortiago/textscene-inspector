/**
 * Tests for TscnDocumentLinkProvider. `provideDocumentLinks` computes ranges only,
 * and `resolveDocumentLink` fills in the target through `findGodotProjectRoot`.
 */

import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnDocumentLinkProvider } from './TscnDocumentLinkProvider';
import { createMockUri, vscode as vscodeMocks } from './test-setup';

function makeDocument(content: string, fsPath = '/workspace/scenes/Door.tscn'): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    uri: createMockUri(fsPath),
    version: 1,
    getText: () => content,
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  } as unknown as vscode.TextDocument;
}

const TOKEN = {} as vscode.CancellationToken;

/** `stat` answers each of `files` as a file and each of `directories` as a directory. Anything else is missing. */
function arrangeDisk(files: readonly string[], directories: readonly string[] = []): void {
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
    const path = uri.fsPath.toLowerCase().replace(/\\/g, '/');
    if (files.includes(path)) return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
    if (directories.includes(path)) return Promise.resolve({ type: 2, ctime: 0, mtime: 0, size: 0 });
    return Promise.reject(new Error('Not found'));
  });
}

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
      > &
        Array<{
          range: { start: { line: number; character: number }; end: { line: number; character: number } };
        }>;

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
      expect(line.slice(links[0]!.range.start.character, links[0]!.range.end.character)).toBe('res://a.png');
      expect(line.slice(links[1]!.range.start.character, links[1]!.range.end.character)).toBe('res://b.png');
    });
  });

  describe('resolveDocumentLink', () => {
    it('gives no target when no directory holds project.godot, since Godot then has no res://', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      arrangeDisk(['/workspace/scenes/door.tscn']);

      const provider = new TscnDocumentLinkProvider();
      const [link] = provider.provideDocumentLinks(makeDocument('path="res://scenes/Door.tscn"'), TOKEN);

      expect(await provider.resolveDocumentLink!(link!, TOKEN)).toBeUndefined();
    });

    it('finds a project.godot created after an earlier link found none', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      const provider = new TscnDocumentLinkProvider();
      // The project sits below the workspace folder, so a root kept from the first lookup is the wrong one.
      const document = makeDocument('path="res://scenes/Door.tscn"', '/workspace/game/scenes/Door.tscn');
      arrangeDisk(['/workspace/game/scenes/door.tscn']);
      await provider.resolveDocumentLink!(provider.provideDocumentLinks(document, TOKEN)[0]!, TOKEN);

      arrangeDisk(['/workspace/game/project.godot', '/workspace/game/scenes/door.tscn']);
      const resolved = await provider.resolveDocumentLink!(
        provider.provideDocumentLinks(document, TOKEN)[0]!,
        TOKEN
      );

      expect((resolved?.target as unknown as { fsPath: string } | undefined)?.fsPath).toBe(
        '/workspace/game/scenes/Door.tscn'
      );
    });

    it('resolves the target relative to a project.godot found above the document', async () => {
      const workspaceRoot = createMockUri('/workspace');
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: workspaceRoot,
      });
      arrangeDisk(['/workspace/game/project.godot', '/workspace/game/scenes/door.tscn']);

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

    it('resolves two sibling Godot projects in one workspace folder against their own roots', async () => {
      // /workspace holds two Godot projects, game1/ and game2/, under one workspace
      // folder, so a cache keyed by the folder alone reuses game1's root for game2.
      const workspaceRoot = createMockUri('/workspace');
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: workspaceRoot,
      });
      arrangeDisk([
        '/workspace/game1/project.godot',
        '/workspace/game2/project.godot',
        '/workspace/game1/props/crate.png',
        '/workspace/game2/props/crate.png',
      ]);

      const provider = new TscnDocumentLinkProvider();

      const line = 'path="res://props/crate.png"';
      const doc1 = makeDocument(line, '/workspace/game1/scenes/Door.tscn');
      const [link1] = provider.provideDocumentLinks(doc1, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;
      const resolved1 = await provider.resolveDocumentLink!(link1!, TOKEN);
      expect((resolved1!.target as unknown as { fsPath: string }).fsPath).toBe(
        '/workspace/game1/props/crate.png'
      );

      const doc2 = makeDocument(line, '/workspace/game2/scenes/Wall.tscn');
      const [link2] = provider.provideDocumentLinks(doc2, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;
      const resolved2 = await provider.resolveDocumentLink!(link2!, TOKEN);
      // game2's own project.godot, not game1's.
      expect((resolved2!.target as unknown as { fsPath: string }).fsPath).toBe(
        '/workspace/game2/props/crate.png'
      );
    });

    it('gives no link for a res:// path that climbs out of the project root', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      arrangeDisk(['/workspace/project.godot', '/home/user/.ssh/id_rsa']);

      const provider = new TscnDocumentLinkProvider();
      const document = makeDocument('path="res://../../../../home/user/.ssh/id_rsa"');
      const [link] = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;

      const resolved = await provider.resolveDocumentLink!(link!, TOKEN);

      expect(resolved).toBeUndefined();
    });

    it('resolves a res:// path whose ".." stays inside the project root', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      arrangeDisk(['/workspace/project.godot', '/workspace/props/crate.png']);

      const provider = new TscnDocumentLinkProvider();
      const document = makeDocument('path="res://scenes/../props/crate.png"');
      const [link] = provider.provideDocumentLinks(document, TOKEN) as unknown as Array<
        Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]
      >;

      const resolved = await provider.resolveDocumentLink!(link!, TOKEN);

      expect((resolved!.target as unknown as { fsPath: string }).fsPath).toBe('/workspace/props/crate.png');
    });

    it('gives no target for a missing file, as the tscn-lsp server does', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      arrangeDisk(['/workspace/project.godot']);

      const provider = new TscnDocumentLinkProvider();
      const [link] = provider.provideDocumentLinks(
        makeDocument('path="res://textures/missing.png"'),
        TOKEN
      ) as unknown as Array<Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]>;

      expect(await provider.resolveDocumentLink!(link!, TOKEN)).toBeUndefined();
    });

    it('gives no target for a directory, which cannot open as a document', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
        uri: createMockUri('/workspace'),
      });
      arrangeDisk(['/workspace/project.godot'], ['/workspace/textures']);

      const provider = new TscnDocumentLinkProvider();
      const [link] = provider.provideDocumentLinks(
        makeDocument('path="res://textures"'),
        TOKEN
      ) as unknown as Array<Parameters<NonNullable<TscnDocumentLinkProvider['resolveDocumentLink']>>[0]>;

      expect(await provider.resolveDocumentLink!(link!, TOKEN)).toBeUndefined();
    });

    it('leaves the target unresolved when the document has no workspace folder', async () => {
      (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

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

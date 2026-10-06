/**
 * Tests for TscnDiagnostics: the pure core-diagnostic -> vscode.Diagnostic
 * mapping and the lint-document flow against a mocked DiagnosticCollection.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import type { Diagnostic as TscnLintDiagnostic } from '@textscene/core/linter';
import {
  TscnDiagnostics,
  toVsCodeDiagnostic,
  DEFAULT_LINT_DEBOUNCE_MS,
  type DocumentLineSource,
} from './TscnDiagnostics';
import { createMockDiagnosticCollection, createMockFileData, createMockUri } from './test-setup';
import {
  ANY_PATH_PATTERN,
  EXTENSION_LIST_PATTERN,
  GDEXTENSION_PATTERN,
  PROJECT_FILE_PATTERN,
  RESOURCE_FILES_PATTERN,
  SCAN_STOP_FILES_PATTERN,
} from './watchPatterns';

/** Configure the mocked `textscene` configuration section for one test. */
function mockDiagnosticsConfig(overrides: { enabled?: boolean; lintDebounceMs?: number } = {}): void {
  const enabled = overrides.enabled ?? true;
  const lintDebounceMs = overrides.lintDebounceMs ?? DEFAULT_LINT_DEBOUNCE_MS;
  (vscode.workspace.getConfiguration as Mock).mockReturnValue({
    get: vi.fn((key: string, defaultValue?: unknown) => {
      if (key === 'diagnostics.enabled') return enabled;
      if (key === 'diagnostics.lintDebounceMs') return lintDebounceMs;
      return defaultValue;
    }),
  });
}

function makeCoreDiagnostic(overrides: Partial<TscnLintDiagnostic> = {}): TscnLintDiagnostic {
  return {
    severity: 'error',
    message: 'Test message',
    nodeName: 'Root',
    nodeType: 'Node3D',
    ruleName: 'test-rule',
    ...overrides,
  };
}

function makeLineSource(content: string): DocumentLineSource {
  const lines = content.split('\n');
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] ?? '' }),
  };
}

function makeTscnDocument(content: string, fsPath = '/workspace/scene.tscn'): vscode.TextDocument {
  const lines = content.split('\n');
  return {
    uri: createMockUri(fsPath),
    fileName: fsPath,
    languageId: 'tscn',
    getText: vi.fn(() => content),
    lineCount: lines.length,
    lineAt: (lineOrPosition: number | vscode.Position) => {
      const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
      return { text: lines[line] ?? '' };
    },
  } as unknown as vscode.TextDocument;
}

/** The committed GLB that requires EXT_mesh_gpu_instancing, which Godot's glTF importer refuses. */
const INSTANCED_TREE = new Uint8Array(
  readFileSync(
    join(
      import.meta.dirname,
      '../../../scenes/fixtures/gltf-unsupported-required-extension/instanced-tree.glb'
    )
  )
);

const VALID_TSCN = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]';
const VALID_TRES = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]';
const INVALID_TSCN = '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\nthis is not a property';

describe('toVsCodeDiagnostic', () => {
  const doc = makeLineSource('first line\nsecond line longer\nthird');

  describe('severity mapping', () => {
    it('maps error to DiagnosticSeverity.Error', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'error' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Error);
    });

    it('maps warning to DiagnosticSeverity.Warning', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'warning' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Warning);
    });

    it('maps info to DiagnosticSeverity.Information', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ severity: 'info' }), doc);
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Information);
    });

    it('floors a severity outside the union to Information, not to the constructor default', () => {
      // `SEVERITY_MAP[<off-union>]` is `undefined`, and `vscode.Diagnostic`
      // defaults an absent severity to Error, the most severe thing in the file.
      const result = toVsCodeDiagnostic(
        makeCoreDiagnostic({
          severity: 'bogus' as unknown as TscnLintDiagnostic['severity'],
        }),
        doc
      );
      expect(result.severity).toBe(vscode.DiagnosticSeverity.Information);
    });
  });

  describe('location mapping', () => {
    it('converts 1-based line/column to 0-based range spanning to end of line', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line: 2, column: 3 } }), doc);

      expect(result.range.start.line).toBe(1);
      expect(result.range.start.character).toBe(2);
      expect(result.range.end.line).toBe(1);
      expect(result.range.end.character).toBe('second line longer'.length);
    });

    it('falls back to a zero range at line 0 when location is missing', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic(), doc);

      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.line).toBe(0);
      expect(result.range.end.character).toBe(0);
    });

    it('falls back to a zero range at line 0 when location has no line', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { column: 5 } }), doc);

      expect(result.range.start.line).toBe(0);
      expect(result.range.start.character).toBe(0);
    });

    it('starts at column 0 when location has a line but no column', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line: 3 } }), doc);

      expect(result.range.start.line).toBe(2);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.character).toBe('third'.length);
    });

    it('clamps out-of-range lines to the last document line', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line: 999, column: 1 } }), doc);

      expect(result.range.start.line).toBe(2);
    });

    it('clamps out-of-range columns to the line length', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line: 3, column: 999 } }), doc);

      expect(result.range.start.character).toBe('third'.length);
      expect(result.range.end.character).toBe('third'.length);
    });

    it('clamps column zero to the start of its line', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line: 2, column: 0 } }), doc);

      expect(result.range.start.line).toBe(1);
      expect(result.range.start.character).toBe(0);
      expect(result.range.end.character).toBe('second line longer'.length);
    });

    // The web gutter reads these the same way (`diagnosticLine`): about the file, not line 1.
    it.each([0, -3, 2.5, Number.NaN])(
      'gives line %s, which no row carries, the zero-width range at the document start',
      (line) => {
        const result = toVsCodeDiagnostic(makeCoreDiagnostic({ location: { line, column: 4 } }), doc);

        expect(result.range.start).toEqual(new vscode.Position(0, 0));
        expect(result.range.end).toEqual(new vscode.Position(0, 0));
      }
    );
  });

  describe('metadata', () => {
    it('sets the rule name as code and tscn-lint as source', () => {
      const result = toVsCodeDiagnostic(makeCoreDiagnostic({ ruleName: 'valid-node3d-visibility' }), doc);

      expect(result.code).toBe('valid-node3d-visibility');
      expect(result.source).toBe('tscn-lint');
      expect(result.message).toBe('Test message');
    });
  });
});

describe('TscnDiagnostics', () => {
  let collection: ReturnType<typeof createMockDiagnosticCollection>;

  /** Diagnostics over the mocked collection, fed by a resource watcher the test's mock creates. */
  function newDiagnostics(): TscnDiagnostics {
    return new TscnDiagnostics(
      vscode.workspace.createFileSystemWatcher(RESOURCE_FILES_PATTERN),
      vscode.workspace.createFileSystemWatcher(PROJECT_FILE_PATTERN),
      collection as unknown as vscode.DiagnosticCollection
    );
  }

  beforeEach(() => {
    collection = createMockDiagnosticCollection('tscn');
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [];
  });

  it('creates its own diagnostic collection when none is injected', () => {
    const diagnostics = new TscnDiagnostics(
      vscode.workspace.createFileSystemWatcher(RESOURCE_FILES_PATTERN),
      vscode.workspace.createFileSystemWatcher(PROJECT_FILE_PATTERN)
    );

    expect(vscode.languages.createDiagnosticCollection).toHaveBeenCalledWith('tscn');
    diagnostics.dispose();
  });

  it('lints already-open .tscn documents on construction', () => {
    const document = makeTscnDocument(INVALID_TSCN);
    (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [document];

    const diagnostics = newDiagnostics();

    expect(collection.set).toHaveBeenCalledTimes(1);
    const [uri, published] = collection.set.mock.calls[0]!;
    expect(uri).toBe(document.uri);
    expect((published as vscode.Diagnostic[]).length).toBeGreaterThan(0);
    expect((published as vscode.Diagnostic[])[0]!.source).toBe('tscn-lint');
    diagnostics.dispose();
  });

  it('publishes an empty diagnostics array for a clean document', () => {
    const diagnostics = newDiagnostics();
    const document = makeTscnDocument(VALID_TSCN);

    diagnostics.lintDocument(document);

    expect(collection.set).toHaveBeenCalledWith(document.uri, []);
    diagnostics.dispose();
  });

  it('publishes a rule finding on the heading of the node it is about, not on the first line', () => {
    const diagnostics = newDiagnostics();
    // A StaticBody2D with no shape child, which Godot's configuration warning names.
    const heading = '[node name="Body" type="StaticBody2D" parent="."]';
    const document = makeTscnDocument(
      `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n${heading}\n`
    );

    diagnostics.lintDocument(document);

    const published = collection.set.mock.calls[0]![1] as vscode.Diagnostic[];
    const finding = published.find((d) => d.code === 'collisionobject2d-needs-collision-shape');
    expect(finding?.range.start).toEqual(new vscode.Position(4, 0));
    expect(finding?.range.end).toEqual(new vscode.Position(4, heading.length));
    diagnostics.dispose();
  });

  it('publishes a dangling reference on the line of the property that holds it', () => {
    const diagnostics = newDiagnostics();
    const document = makeTscnDocument(
      '[gd_scene format=3]\n\n[node name="Box" type="CSGBox3D"]\nmaterial = SubResource("nope")\n'
    );

    diagnostics.lintDocument(document);

    const published = collection.set.mock.calls[0]![1] as vscode.Diagnostic[];
    const finding = published.find((d) => d.code === 'dangling-resource-reference');
    expect(finding?.range.start.line).toBe(3);
    diagnostics.dispose();
  });

  it('ignores non-.tscn documents', () => {
    const diagnostics = newDiagnostics();
    const document = {
      ...makeTscnDocument(VALID_TSCN, '/workspace/readme.md'),
      languageId: 'markdown',
      fileName: '/workspace/readme.md',
    } as unknown as vscode.TextDocument;

    diagnostics.lintDocument(document);

    expect(collection.set).not.toHaveBeenCalled();
    diagnostics.dispose();
  });

  // Both text formats the linter takes, through both arms of `isTscnDocument`:
  // the `tscn` language claims `.tres` too, and the filename arm is the
  // fallback for a document whose association a user overrode.
  it('publishes for a .tres document the tscn language claims', () => {
    const diagnostics = newDiagnostics();
    const document = makeTscnDocument(VALID_TRES, '/workspace/material.tres');

    diagnostics.lintDocument(document);

    expect(collection.set).toHaveBeenCalledWith(document.uri, expect.any(Array));
    diagnostics.dispose();
  });

  it.each([
    ['.tres', '/workspace/material.tres', VALID_TRES],
    ['.tscn', '/workspace/scene.tscn', VALID_TSCN],
  ])(
    'publishes for a %s document whose language association was overridden',
    (_extension, fsPath, content) => {
      const diagnostics = newDiagnostics();
      const document = {
        ...makeTscnDocument(content, fsPath),
        languageId: 'plaintext',
        fileName: fsPath,
      } as unknown as vscode.TextDocument;

      diagnostics.lintDocument(document);

      expect(collection.set).toHaveBeenCalledWith(document.uri, expect.any(Array));
      diagnostics.dispose();
    }
  );

  it('re-lints on open and on save via workspace events', () => {
    let openHandler: ((document: vscode.TextDocument) => void) | undefined;
    let saveHandler: ((document: vscode.TextDocument) => void) | undefined;
    (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation((handler) => {
      openHandler = handler;
      return { dispose: vi.fn() };
    });
    (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation((handler) => {
      saveHandler = handler;
      return { dispose: vi.fn() };
    });

    const diagnostics = newDiagnostics();
    const document = makeTscnDocument(VALID_TSCN);

    openHandler!(document);
    expect(collection.set).toHaveBeenCalledTimes(1);

    saveHandler!(makeTscnDocument(INVALID_TSCN));
    expect(collection.set).toHaveBeenCalledTimes(2);
    diagnostics.dispose();
  });

  it('debounces change events (~300ms) into a single lint', () => {
    vi.useFakeTimers();
    try {
      let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(VALID_TSCN);

      changeHandler!({ document });
      changeHandler!({ document });
      changeHandler!({ document });
      expect(collection.set).not.toHaveBeenCalled();

      vi.advanceTimersByTime(299);
      expect(collection.set).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(collection.set).toHaveBeenCalledTimes(1);
      diagnostics.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears diagnostics and pending lints when a document closes', () => {
    vi.useFakeTimers();
    try {
      let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
      let closeHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return { dispose: vi.fn() };
      });
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation((handler) => {
        closeHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(VALID_TSCN);

      changeHandler!({ document });
      closeHandler!(document);

      expect(collection.delete).toHaveBeenCalledWith(document.uri);

      // The pending debounced lint must have been cancelled.
      vi.advanceTimersByTime(1000);
      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('disposes listeners, timers, and the collection', () => {
    vi.useFakeTimers();
    try {
      const disposeSpies = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
      let spyIndex = 0;
      const nextDisposable = () => ({ dispose: disposeSpies[spyIndex++]! });
      let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation(() => nextDisposable());
      (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation(() => nextDisposable());
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
        changeHandler = handler;
        return nextDisposable();
      });
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation(() => nextDisposable());

      const diagnostics = newDiagnostics();
      changeHandler!({ document: makeTscnDocument(VALID_TSCN) });

      diagnostics.dispose();

      for (const spy of disposeSpies) {
        expect(spy).toHaveBeenCalledTimes(1);
      }
      expect(collection.dispose).toHaveBeenCalledTimes(1);

      // The pending debounced lint must not fire after dispose.
      vi.advanceTimersByTime(1000);
      expect(collection.set).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  describe('dependencies read through the workspace', () => {
    // The root heading inherits the GLB, so a refusal fails the scene's load.
    const SCENE_USING_TREE = [
      '[gd_scene format=3]',
      '',
      '[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]',
      '',
      '[node name="Tree" instance=ExtResource("1_tree")]',
    ].join('\n');
    const RULE = 'gltf-required-extension-unsupported';

    /** Each read of the GLB, held until the test releases it. */
    let pendingReads: Array<() => void>;

    beforeEach(() => {
      mockDiagnosticsConfig();
      // Earlier tests leave handler-capturing implementations behind, which
      // `vi.clearAllMocks()` keeps. Each test here starts from pass-throughs.
      for (const event of [
        vscode.workspace.onDidOpenTextDocument,
        vscode.workspace.onDidSaveTextDocument,
        vscode.workspace.onDidChangeTextDocument,
        vscode.workspace.onDidCloseTextDocument,
        vscode.workspace.onDidChangeConfiguration,
      ]) {
        (event as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      }
      pendingReads = [];
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue({ uri: createMockUri('/workspace') });
      // The GLB's modification time moves each time a read of it settles, so each lint reads it again, while lints
      // that overlap share one read.
      let glbMtime = 0;
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/project.godot')
          return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
        if (uri.fsPath === '/workspace/tree.glb')
          return Promise.resolve({ type: 1, ctime: 0, mtime: glbMtime, size: INSTANCED_TREE.length });
        return Promise.reject(new Error('Not found'));
      });
      // A project file that lets nothing add to the importer, and a listing (`findFiles`) that finds no GDExtension.
      (vscode.workspace.fs.readFile as Mock).mockImplementation((uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/project.godot')
          return Promise.resolve(createMockFileData('config_version=5\n'));
        return uri.fsPath === '/workspace/tree.glb'
          ? new Promise((resolve) =>
              pendingReads.push(() => {
                glbMtime++;
                resolve(INSTANCED_TREE);
              })
            )
          : Promise.reject(new Error(`Not found: ${uri.fsPath}`));
      });
      (vscode.workspace.findFiles as Mock).mockResolvedValue([]);
    });

    afterEach(() => {
      (vscode.workspace.getWorkspaceFolder as Mock).mockReset();
      (vscode.workspace.fs.stat as Mock).mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 });
      (vscode.workspace.fs.readFile as Mock).mockResolvedValue(new Uint8Array());
    });

    /** Releases every GLB read, once the provider has asked for one. */
    async function releaseReads(): Promise<void> {
      await vi.waitFor(() => expect(pendingReads.length).toBeGreaterThan(0));
      for (const release of pendingReads.splice(0)) release();
    }

    function publishedCodes(call: number): unknown[] {
      return (collection.set.mock.calls[call]![1] as vscode.Diagnostic[]).map((d) => d.code);
    }

    it('publishes the file-local lint at once, then a refused glTF on its ext_resource heading', async () => {
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');

      diagnostics.lintDocument(document);
      expect(collection.set).toHaveBeenCalledTimes(1);
      expect(publishedCodes(0)).not.toContain(RULE);

      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));
      const finding = (collection.set.mock.calls[1]![1] as vscode.Diagnostic[]).find((d) => d.code === RULE);
      expect(finding?.range.start.line).toBe(2);
      expect(finding?.severity).toBe(vscode.DiagnosticSeverity.Error);
      diagnostics.dispose();
    });

    it('publishes no cross-file result for a document edited since its lint, whose own lint publishes next', async () => {
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');
      const versioned = document as unknown as { version: number };
      versioned.version = 1;

      diagnostics.lintDocument(document);
      await vi.waitFor(() => expect(pendingReads.length).toBeGreaterThan(0));
      versioned.version = 2;
      for (const release of pendingReads.splice(0)) release();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(collection.set).toHaveBeenCalledTimes(1);
      diagnostics.dispose();
    });

    it('drops a cross-file result that a newer lint of the document has overtaken, and shares its read', async () => {
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');
      const moved = makeTscnDocument(`\n${SCENE_USING_TREE}`, '/workspace/scenes/level.tscn');

      diagnostics.lintDocument(document);
      await vi.waitFor(() => expect(pendingReads.length).toBe(1));
      diagnostics.lintDocument(moved);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const findingLines = collection.set.mock.calls.flatMap(([, list]) =>
        (list as vscode.Diagnostic[]).filter((d) => d.code === RULE).map((d) => d.range.start.line)
      );
      expect(findingLines).toEqual([3]);
      expect(pendingReads).toHaveLength(0);
      diagnostics.dispose();
    });

    it('drops a cross-file result for a document closed while it was read', async () => {
      let closeHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation((handler) => {
        closeHandler = handler;
        return { dispose: vi.fn() };
      });
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');

      diagnostics.lintDocument(document);
      await vi.waitFor(() => expect(pendingReads.length).toBe(1));
      closeHandler!(document);
      await releaseReads();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(collection.set).toHaveBeenCalledTimes(1);
      diagnostics.dispose();
    });

    it('publishes once for a scene that uses no glTF', async () => {
      const diagnostics = newDiagnostics();

      diagnostics.lintDocument(makeTscnDocument(VALID_TSCN, '/workspace/scenes/plain.tscn'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(collection.set).toHaveBeenCalledTimes(1);
      expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
      diagnostics.dispose();
    });

    it('shares one project walk and one provider between the documents of a project', async () => {
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
        ['/workspace/project.godot', '/workspace/tree.glb'].includes(uri.fsPath)
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 1, size: 1 })
          : Promise.reject(new Error('Not found'))
      );
      // The walk from `scenes/` asks its own directory first. The plugin probe stamps only the root's project file.
      const projectFileChecks = () =>
        (vscode.workspace.fs.stat as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/scenes/project.godot'
        ).length;
      const glbReads = () =>
        (vscode.workspace.fs.readFile as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/tree.glb'
        ).length;
      const diagnostics = newDiagnostics();
      const first = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/a.tscn');
      const second = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/b.tscn');

      diagnostics.lintDocument(first);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));
      diagnostics.lintDocument(second);
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(4));

      expect(projectFileChecks()).toBe(1);
      expect(glbReads()).toBe(1);
      expect(publishedCodes(3)).toContain(RULE);
      diagnostics.dispose();
    });

    it("reads a glTF under the document's own directory for a scene outside every project", async () => {
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
        uri.fsPath === '/workspace/isometric/tree.glb'
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: INSTANCED_TREE.length })
          : Promise.reject(new Error('Not found'))
      );
      (vscode.workspace.fs.readFile as Mock).mockImplementation((uri: vscode.Uri) =>
        uri.fsPath === '/workspace/isometric/tree.glb'
          ? Promise.resolve(INSTANCED_TREE)
          : Promise.reject(new Error(`Not found: ${uri.fsPath}`))
      );
      const diagnostics = newDiagnostics();

      diagnostics.lintDocument(makeTscnDocument(SCENE_USING_TREE, '/workspace/isometric/dungeon.tscn'));
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      // No project.godot to read, so a plugin may add the extension, and the refusal is only likely.
      expect(publishedCodes(1)).toContain('gltf-required-extension-maybe-unsupported');
      diagnostics.dispose();
    });

    it("roots the provider of a scene outside every project at the scene's own directory", async () => {
      (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('Not found'));
      const diagnostics = newDiagnostics();

      const provider = await diagnostics.providerFor(createMockUri('/workspace/isometric/dungeon.tscn'));

      expect(provider?.fileOf('res://tree.glb')?.fsPath).toBe('/workspace/isometric/tree.glb');
      diagnostics.dispose();
    });

    it('roots the provider of a scene inside a project at the project, not the scene directory', async () => {
      const diagnostics = newDiagnostics();

      const provider = await diagnostics.providerFor(createMockUri('/workspace/scenes/level.tscn'));

      expect(provider?.fileOf('res://tree.glb')?.fsPath).toBe('/workspace/tree.glb');
      diagnostics.dispose();
    });

    it('shares a provider between the loose scenes of one directory, and only those', async () => {
      (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('Not found'));
      const diagnostics = newDiagnostics();

      const [dungeon, player, elsewhere] = await Promise.all(
        [
          '/workspace/isometric/dungeon.tscn',
          '/workspace/isometric/player.tscn',
          '/workspace/other/a.tscn',
        ].map((path) => diagnostics.providerFor(createMockUri(path)))
      );

      expect(player).toBe(dungeon);
      expect(elsewhere).not.toBe(dungeon);
      diagnostics.dispose();
    });

    it('gives no provider outside every workspace folder', async () => {
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);
      const diagnostics = newDiagnostics();

      expect(await diagnostics.providerFor(createMockUri('/elsewhere/dungeon.tscn'))).toBeNull();
      diagnostics.dispose();
    });

    it('publishes nothing again while an edit leaves the list as it is shown', async () => {
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');

      diagnostics.lintDocument(document);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      diagnostics.lintDocument(makeTscnDocument(`${SCENE_USING_TREE}\n`, '/workspace/scenes/level.tscn'));
      expect(collection.set).toHaveBeenCalledTimes(2);
      expect(publishedCodes(1)).toContain(RULE);

      await releaseReads();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(collection.set).toHaveBeenCalledTimes(2);
      diagnostics.dispose();
    });

    it('publishes again when an edit lengthens a flagged line, since its range ends at the line end', async () => {
      const diagnostics = newDiagnostics();
      diagnostics.lintDocument(makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn'));
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      const lengthened = SCENE_USING_TREE.replace('id="1_tree"]', 'id="1_tree"]   ');
      diagnostics.lintDocument(makeTscnDocument(lengthened, '/workspace/scenes/level.tscn'));

      expect(collection.set).toHaveBeenCalledTimes(3);
      const finding = (collection.set.mock.calls[2]![1] as vscode.Diagnostic[]).find((d) => d.code === RULE);
      expect(finding?.range.end.character).toBe(lengthened.split('\n')[2]!.length);
      diagnostics.dispose();
    });

    it('moves the kept cross-file error to the line its ext_resource moved to while the glTF is re-read', async () => {
      const diagnostics = newDiagnostics();
      diagnostics.lintDocument(makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn'));
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      const shifted = SCENE_USING_TREE.replace('\n\n[ext_resource', '\n\n\n\n[ext_resource');
      diagnostics.lintDocument(makeTscnDocument(shifted, '/workspace/scenes/level.tscn'));

      const kept = (collection.set.mock.calls.at(-1)![1] as vscode.Diagnostic[]).find((d) => d.code === RULE);
      expect(kept?.range.start.line).toBe(4);
      diagnostics.dispose();
    });

    it('drops the kept cross-file error once its ext_resource id is gone', async () => {
      const diagnostics = newDiagnostics();
      diagnostics.lintDocument(makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn'));
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      const renamed = SCENE_USING_TREE.replaceAll('1_tree', '2_tree');
      diagnostics.lintDocument(makeTscnDocument(renamed, '/workspace/scenes/level.tscn'));

      const published = collection.set.mock.calls.at(-1)![1] as vscode.Diagnostic[];
      expect(published.map((d) => d.code)).not.toContain(RULE);
      diagnostics.dispose();
    });

    it('drops the cross-file error once an edit leaves the scene with no glTF to read', async () => {
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');
      diagnostics.lintDocument(document);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      diagnostics.lintDocument(makeTscnDocument(VALID_TSCN, '/workspace/scenes/level.tscn'));

      expect(publishedCodes(2)).not.toContain(RULE);
      diagnostics.dispose();
    });

    it('forgets the cross-file error of a closed document', async () => {
      let closeHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation((handler) => {
        closeHandler = handler;
        return { dispose: vi.fn() };
      });
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');
      diagnostics.lintDocument(document);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));

      closeHandler!(document);
      diagnostics.lintDocument(document);

      expect(publishedCodes(2)).not.toContain(RULE);
      diagnostics.dispose();
    });

    it('reads an unchanged glTF once across lints, and again once its stamp changes', async () => {
      let mtime = 1;
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/project.godot')
          return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
        if (uri.fsPath === '/workspace/tree.glb') {
          return Promise.resolve({ type: 1, ctime: 0, mtime, size: INSTANCED_TREE.length });
        }
        return Promise.reject(new Error('Not found'));
      });
      const glbReads = () =>
        (vscode.workspace.fs.readFile as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/tree.glb'
        ).length;
      const diagnostics = newDiagnostics();
      const document = makeTscnDocument(SCENE_USING_TREE, '/workspace/scenes/level.tscn');

      diagnostics.lintDocument(document);
      await releaseReads();
      await vi.waitFor(() => expect(collection.set).toHaveBeenCalledTimes(2));
      diagnostics.lintDocument(document);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(publishedCodes(1)).toContain(RULE);
      expect(glbReads()).toBe(1);

      mtime = 2;
      diagnostics.lintDocument(document);
      await releaseReads();
      expect(glbReads()).toBe(2);
      diagnostics.dispose();
    });

    it('reads nothing for a document outside every workspace folder', async () => {
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);
      const diagnostics = newDiagnostics();

      diagnostics.lintDocument(makeTscnDocument(SCENE_USING_TREE, '/elsewhere/level.tscn'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
      expect(collection.set).toHaveBeenCalledTimes(1);
      diagnostics.dispose();
    });
  });

  describe('dependency files changing on disk', () => {
    type WatcherEvent = (uri: vscode.Uri) => void;
    interface Watcher {
      pattern: string;
      /** The `ignoreCreateEvents`, `ignoreChangeEvents` and `ignoreDeleteEvents` arguments, as passed. */
      ignores: [boolean?, boolean?, boolean?];
      fire: Record<'change' | 'create' | 'delete', WatcherEvent[]>;
      dispose: Mock;
    }
    let watchers: Watcher[];
    let savedTextDocuments: vscode.TextDocument[];

    const FOLDERS = ['/workspace', '/other'];

    /** A scene in `dir` whose `Tree` node instances `res://tree.glb`. */
    function sceneUsingTree(dir: string): vscode.TextDocument {
      return makeTscnDocument(
        [
          '[gd_scene format=3]',
          '',
          '[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]',
          '',
          '[node name="Root" type="Node3D"]',
          '',
          '[node name="Tree" parent="." instance=ExtResource("1_tree")]',
        ].join('\n'),
        `${dir}/level.tscn`
      );
    }

    function folderOf(uri: vscode.Uri) {
      const root = FOLDERS.find((prefix) => uri.fsPath.startsWith(`${prefix}/`));
      return root ? { uri: createMockUri(root) } : undefined;
    }

    /** The patterns of the file watchers that report `fsPath`, as the file watcher would route it. */
    function filePatternsFor(fsPath: string): string[] {
      if (fsPath.endsWith('/project.godot')) return [PROJECT_FILE_PATTERN, SCAN_STOP_FILES_PATTERN];
      if (fsPath.endsWith('/.gdignore')) return [SCAN_STOP_FILES_PATTERN];
      if (fsPath.endsWith('/extension_list.cfg')) return [EXTENSION_LIST_PATTERN];
      if (fsPath.toLowerCase().endsWith('.gdextension')) return [GDEXTENSION_PATTERN];
      return [RESOURCE_FILES_PATTERN];
    }

    /** Every pattern that matches `fsPath`: its file patterns, and the one that matches any path. */
    function patternsFor(fsPath: string): string[] {
      return [...filePatternsFor(fsPath), ANY_PATH_PATTERN];
    }

    /** Fires the one event VS Code reports for a deleted folder: no file pattern matches its path. */
    function deleteFolder(fsPath: string): void {
      for (const watcher of watchers.filter((w) => w.pattern === ANY_PATH_PATTERN)) {
        for (const handler of watcher.fire.delete) handler(createMockUri(fsPath));
      }
    }

    function fire(kind: 'change' | 'create' | 'delete', fsPath: string): void {
      for (const watcher of watchers.filter((w) => patternsFor(fsPath).includes(w.pattern))) {
        for (const handler of watcher.fire[kind]) handler(createMockUri(fsPath));
      }
    }

    function open(...documents: vscode.TextDocument[]): void {
      (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = documents;
    }

    /** How often `document` has been linted: each lint reads its text once. */
    function lintsOf(document: vscode.TextDocument): number {
      return (document.getText as Mock).mock.calls.length;
    }

    /** Lets each open document's project walk answer, and the lint that follows it run. */
    async function settleWalks(): Promise<void> {
      await vi.advanceTimersByTimeAsync(0);
    }

    beforeEach(() => {
      vi.useFakeTimers();
      mockDiagnosticsConfig();
      for (const event of [
        vscode.workspace.onDidOpenTextDocument,
        vscode.workspace.onDidSaveTextDocument,
        vscode.workspace.onDidChangeTextDocument,
        vscode.workspace.onDidCloseTextDocument,
        vscode.workspace.onDidChangeConfiguration,
        vscode.workspace.onDidChangeWorkspaceFolders,
      ]) {
        (event as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      }
      savedTextDocuments = vscode.workspace.textDocuments as vscode.TextDocument[];
      watchers = [];
      (vscode.workspace.createFileSystemWatcher as Mock).mockImplementation(
        (pattern: string, ...ignores: Watcher['ignores']) => {
          const watcher: Watcher = {
            pattern,
            ignores,
            fire: { change: [], create: [], delete: [] },
            dispose: vi.fn(),
          };
          watchers.push(watcher);
          const on = (kind: keyof Watcher['fire']) => (handler: WatcherEvent) => {
            watcher.fire[kind].push(handler);
            return { dispose: vi.fn() };
          };
          return {
            onDidChange: on('change'),
            onDidCreate: on('create'),
            onDidDelete: on('delete'),
            dispose: watcher.dispose,
          };
        }
      );
      (vscode.workspace.getWorkspaceFolder as Mock).mockImplementation(folderOf);
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
        ['/workspace/project.godot', '/workspace/tree.glb'].includes(uri.fsPath)
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
          : Promise.reject(new Error('Not found'))
      );
    });

    afterEach(() => {
      vi.useRealTimers();
      open(...savedTextDocuments);
      (vscode.workspace.getWorkspaceFolder as Mock).mockReset();
      (vscode.workspace.fs.stat as Mock).mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 });
    });

    it('watches the GDExtension list, .gdextension files, scan stop files and deleted paths itself, and glTF files and project.godot through the extension’s watchers', () => {
      const diagnostics = newDiagnostics();

      expect(watchers.map((w) => w.pattern).sort()).toEqual(
        [
          RESOURCE_FILES_PATTERN,
          PROJECT_FILE_PATTERN,
          EXTENSION_LIST_PATTERN,
          GDEXTENSION_PATTERN,
          SCAN_STOP_FILES_PATTERN,
          ANY_PATH_PATTERN,
        ].sort()
      );
      diagnostics.dispose();
    });

    it('watches every path for deletes only', () => {
      const diagnostics = newDiagnostics();
      const anyPath = watchers.find((w) => w.pattern === ANY_PATH_PATTERN)!;

      expect(anyPath.ignores).toEqual([true, true, false]);
      expect(anyPath.fire.create).toEqual([]);
      expect(anyPath.fire.change).toEqual([]);
      diagnostics.dispose();
    });

    describe('a deleted folder', () => {
      const GDEXTENSION = '/workspace/addons/gltf_ext/ext.gdextension';

      beforeEach(() => {
        // A refused GLB and a project file that leaves the answer to the listing, which finds one GDExtension.
        (vscode.workspace.fs.readFile as Mock).mockImplementation(async (uri: vscode.Uri) => {
          if (uri.fsPath === '/workspace/tree.glb') return INSTANCED_TREE;
          if (uri.fsPath === '/workspace/project.godot')
            return new TextEncoder().encode('config_version=5\n');
          throw new Error('Not found');
        });
        (vscode.workspace.findFiles as Mock).mockImplementation(async (include: vscode.RelativePattern) =>
          include.pattern === SCAN_STOP_FILES_PATTERN ? [] : [createMockUri(GDEXTENSION)]
        );
      });

      afterEach(() => {
        (vscode.workspace.fs.readFile as Mock).mockResolvedValue(new Uint8Array());
        (vscode.workspace.findFiles as Mock).mockResolvedValue([]);
      });

      it("re-lints each open document whose project's listing found a .gdextension under it", async () => {
        const level = sceneUsingTree('/workspace/scenes');
        const elsewhere = sceneUsingTree('/other');
        open(level, elsewhere);
        const diagnostics = newDiagnostics();
        await settleWalks();
        expect(vscode.workspace.findFiles).toHaveBeenCalled();
        const before = [level, elsewhere].map(lintsOf);

        deleteFolder('/workspace/addons/gltf_ext');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

        expect([level, elsewhere].map(lintsOf)).toEqual([before[0]! + 1, before[1]]);
        diagnostics.dispose();
      });

      it('re-lints each open document whose last lint read a file under it', async () => {
        const level = sceneUsingTree('/workspace/scenes');
        open(level);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const before = lintsOf(level);

        // The probe reads the GDExtension list at `res://.godot/extension_list.cfg`.
        deleteFolder('/workspace/.godot');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

        expect(lintsOf(level)).toBe(before + 1);
        diagnostics.dispose();
      });

      it('re-lints nothing when no read or listed path is under it', async () => {
        const level = sceneUsingTree('/workspace/scenes');
        open(level);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const before = lintsOf(level);

        deleteFolder('/workspace/addons/unrelated');
        deleteFolder('/workspace/addons/gltf');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

        expect(lintsOf(level)).toBe(before);
        diagnostics.dispose();
      });

      it('walks again for each document whose project root it held, asking each directory afresh', async () => {
        const level = sceneUsingTree('/workspace/scenes');
        open(level);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const projectStats = () =>
          (vscode.workspace.fs.stat as Mock).mock.calls.filter(
            ([uri]) => uri.fsPath === '/workspace/project.godot'
          ).length;
        const statsBefore = projectStats();
        const readsBefore = (vscode.workspace.fs.readFile as Mock).mock.calls.length;
        (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('Not found'));

        deleteFolder('/workspace');
        await settleWalks();

        expect(projectStats()).toBe(statsBefore + 1);
        expect((vscode.workspace.fs.readFile as Mock).mock.calls.length).toBe(readsBefore);
        diagnostics.dispose();
      });
    });

    it.each(['create', 'delete'] as const)(
      're-lints each open document of the project whose last lint read a glTF when a .gdextension is %sd',
      async (kind) => {
        const level = sceneUsingTree('/workspace/scenes');
        const plain = makeTscnDocument(VALID_TSCN, '/workspace/plain.tscn');
        const elsewhere = sceneUsingTree('/other');
        open(level, plain, elsewhere);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const before = [level, plain, elsewhere].map(lintsOf);

        fire(kind, '/workspace/addons/gltf/bin/Gltf.GDExtension');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

        expect([level, plain, elsewhere].map(lintsOf)).toEqual([before[0]! + 1, before[1], before[2]]);
        diagnostics.dispose();
      }
    );

    it('does not re-lint when a .gdextension file only changes, since only its presence counts', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const before = lintsOf(level);

      fire('change', '/workspace/bin/a.gdextension');
      vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

      expect(lintsOf(level)).toBe(before);
      diagnostics.dispose();
    });

    it.each(['create', 'delete'] as const)(
      're-lints each open document of the project whose last lint read a glTF when a .gdignore is %sd',
      async (kind) => {
        const level = sceneUsingTree('/workspace/scenes');
        const plain = makeTscnDocument(VALID_TSCN, '/workspace/plain.tscn');
        const elsewhere = sceneUsingTree('/other');
        open(level, plain, elsewhere);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const before = [level, plain, elsewhere].map(lintsOf);

        fire(kind, '/workspace/addons/gltf/.gdignore');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

        expect([level, plain, elsewhere].map(lintsOf)).toEqual([before[0]! + 1, before[1], before[2]]);
        diagnostics.dispose();
      }
    );

    it('re-lints the documents of the enclosing project when a project.godot is created in one of its folders', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const before = lintsOf(level);

      fire('create', '/workspace/addons/gltf/project.godot');
      await vi.advanceTimersByTimeAsync(DEFAULT_LINT_DEBOUNCE_MS);

      expect(lintsOf(level)).toBe(before + 1);
      diagnostics.dispose();
    });

    it('walks again for each open document when the workspace folders change', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      let onFoldersChanged: () => void = () => {};
      (vscode.workspace.onDidChangeWorkspaceFolders as Mock).mockImplementation((handler: () => void) => {
        onFoldersChanged = handler;
        return { dispose: vi.fn() };
      });
      (vscode.workspace.getWorkspaceFolder as Mock).mockReturnValue(undefined);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const tree = () =>
        (vscode.workspace.fs.readFile as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/tree.glb'
        ).length;
      expect(tree()).toBe(0);

      (vscode.workspace.getWorkspaceFolder as Mock).mockImplementation(folderOf);
      onFoldersChanged();
      await settleWalks();

      expect(tree()).toBe(1);
      diagnostics.dispose();
    });

    it('forgets the directory answers on a project.godot event while diagnostics are off', async () => {
      let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
        configHandler = handler;
        return { dispose: vi.fn() };
      });
      const toggle = (enabled: boolean) => {
        mockDiagnosticsConfig({ enabled });
        configHandler!({ affectsConfiguration: (section: string) => section === 'textscene.diagnostics' });
      };
      let hasRootProject = false;
      let releaseScenes: () => void = () => {};
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/scenes/project.godot') {
          return new Promise((_resolve, reject) => (releaseScenes = () => reject(new Error('Not found'))));
        }
        if (uri.fsPath === '/workspace/tree.glb')
          return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
        return uri.fsPath === '/workspace/project.godot' && hasRootProject
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
          : Promise.reject(new Error('Not found'));
      });
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();

      // The walk is still waiting on its first directory when diagnostics go off, and answers the root after it.
      toggle(false);
      releaseScenes();
      await settleWalks();
      hasRootProject = true;
      fire('create', '/workspace/project.godot');
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
        ['/workspace/project.godot', '/workspace/tree.glb'].includes(uri.fsPath)
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
          : Promise.reject(new Error('Not found'))
      );
      toggle(true);
      await settleWalks();

      expect(
        (vscode.workspace.fs.readFile as Mock).mock.calls.some(
          ([uri]) => uri.fsPath === '/workspace/tree.glb'
        )
      ).toBe(true);
      diagnostics.dispose();
    });

    it.each(['change', 'create', 'delete'] as const)(
      're-lints, after the edit debounce, only each open document whose last lint read a glTF that is %sd',
      async (kind) => {
        const level = sceneUsingTree('/workspace/scenes');
        const plain = makeTscnDocument(VALID_TSCN, '/workspace/plain.tscn');
        const elsewhere = sceneUsingTree('/other');
        const readme = {
          ...makeTscnDocument(VALID_TSCN, '/workspace/readme.md'),
          languageId: 'markdown',
          fileName: '/workspace/readme.md',
        } as unknown as vscode.TextDocument;
        open(level, plain, elsewhere, readme);
        const diagnostics = newDiagnostics();
        await settleWalks();
        const before = [level, plain, elsewhere, readme].map(lintsOf);

        fire(kind, '/workspace/tree.glb');
        vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS - 1);
        expect(lintsOf(level)).toBe(before[0]);
        vi.advanceTimersByTime(1);

        expect([level, plain, elsewhere, readme].map(lintsOf)).toEqual([before[0]! + 1, ...before.slice(1)]);
        diagnostics.dispose();
      }
    );

    it('re-lints a document that reads the glTF through an uppercase extension', async () => {
      const level = makeTscnDocument(
        sceneUsingTree('/workspace').getText().replace('res://tree.glb', 'res://TREE.GLB'),
        '/workspace/level.tscn'
      );
      open(level);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const before = lintsOf(level);

      fire('change', '/workspace/TREE.GLB');
      vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

      expect(lintsOf(level)).toBe(before + 1);
      diagnostics.dispose();
    });

    it('re-lints a document that reads a glTF when the GDExtension list changes', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      const plain = makeTscnDocument(VALID_TSCN, '/workspace/plain.tscn');
      open(level, plain);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const before = [level, plain].map(lintsOf);

      fire('change', '/workspace/.godot/extension_list.cfg');
      vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

      expect([level, plain].map(lintsOf)).toEqual([before[0]! + 1, before[1]]);
      diagnostics.dispose();
    });

    it('ignores a file outside every project', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();
      await settleWalks();
      const before = lintsOf(level);

      fire('change', '/elsewhere/tree.glb');
      vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

      expect(lintsOf(level)).toBe(before);
      diagnostics.dispose();
    });

    it('re-lints nothing while diagnostics are disabled', () => {
      mockDiagnosticsConfig({ enabled: false });
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();

      fire('change', '/workspace/tree.glb');
      fire('change', '/workspace/project.godot');
      vi.advanceTimersByTime(DEFAULT_LINT_DEBOUNCE_MS);

      expect(lintsOf(level)).toBe(0);
      diagnostics.dispose();
    });

    it('walks again and re-lints each document under a project.godot that changes, and no other', async () => {
      const level = sceneUsingTree('/workspace/scenes');
      const elsewhere = sceneUsingTree('/other');
      open(level, elsewhere);
      // The walk from `scenes/` asks its own directory first. The plugin probe stamps only the root's project file.
      const projectFileChecks = () =>
        (vscode.workspace.fs.stat as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/scenes/project.godot'
        ).length;
      const diagnostics = newDiagnostics();
      await settleWalks();
      expect(projectFileChecks()).toBe(1);

      fire('change', '/workspace/tree.glb');
      await vi.advanceTimersByTimeAsync(DEFAULT_LINT_DEBOUNCE_MS);
      expect(projectFileChecks()).toBe(1);
      const before = [level, elsewhere].map(lintsOf);

      fire('change', '/workspace/project.godot');
      await settleWalks();

      expect(projectFileChecks()).toBe(2);
      expect([level, elsewhere].map(lintsOf)).toEqual([before[0]! + 1, before[1]]);
      diagnostics.dispose();
    });

    it('keeps the verdicts of a project whose root a project.godot event leaves unchanged', async () => {
      (vscode.workspace.fs.stat as Mock).mockImplementation((uri: vscode.Uri) =>
        ['/workspace/project.godot', '/workspace/tree.glb'].includes(uri.fsPath)
          ? Promise.resolve({ type: 1, ctime: 0, mtime: 1, size: 1 })
          : Promise.reject(new Error('Not found'))
      );
      const glbReads = () =>
        (vscode.workspace.fs.readFile as Mock).mock.calls.filter(
          ([uri]) => uri.fsPath === '/workspace/tree.glb'
        ).length;
      const level = sceneUsingTree('/workspace/scenes');
      open(level);
      const diagnostics = newDiagnostics();
      await settleWalks();
      expect(glbReads()).toBe(1);

      fire('change', '/workspace/project.godot');
      await settleWalks();

      expect(glbReads()).toBe(1);
      diagnostics.dispose();
    });

    it('disposes the watchers it creates with itself, and leaves the resource and project watchers to their owner', () => {
      const diagnostics = newDiagnostics();
      const ownedElsewhere = [RESOURCE_FILES_PATTERN, PROJECT_FILE_PATTERN];

      diagnostics.dispose();

      expect(watchers).toHaveLength(6);
      for (const watcher of watchers) {
        expect(watcher.dispose).toHaveBeenCalledTimes(ownedElsewhere.includes(watcher.pattern) ? 0 : 1);
      }
    });
  });

  describe('textscene.diagnostics.* configuration', () => {
    // Earlier tests replace `onDidOpenTextDocument` and the others through
    // `.mockImplementation`, and the shared `vi.clearAllMocks()` clears calls, not
    // implementations. Each test here starts with all five as a pass-through
    // disposable and overrides the handler it captures.
    beforeEach(() => {
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidSaveTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidCloseTextDocument as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation(() => ({ dispose: vi.fn() }));
    });

    it('does not lint already-open documents on construction when diagnostics.enabled is false', () => {
      mockDiagnosticsConfig({ enabled: false });
      const document = makeTscnDocument(VALID_TSCN);
      (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [document];

      const diagnostics = newDiagnostics();

      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    });

    it('ignores open/save/change requests while disabled', () => {
      mockDiagnosticsConfig({ enabled: false });
      let openHandler: ((document: vscode.TextDocument) => void) | undefined;
      (vscode.workspace.onDidOpenTextDocument as Mock).mockImplementation((handler) => {
        openHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = newDiagnostics();
      openHandler!(makeTscnDocument(VALID_TSCN));

      expect(collection.set).not.toHaveBeenCalled();
      diagnostics.dispose();
    });

    it('uses the configured lintDebounceMs instead of the 300ms default', () => {
      mockDiagnosticsConfig({ lintDebounceMs: 1000 });
      vi.useFakeTimers();
      try {
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        });

        const diagnostics = newDiagnostics();
        const document = makeTscnDocument(VALID_TSCN);

        changeHandler!({ document });

        vi.advanceTimersByTime(300);
        expect(collection.set).not.toHaveBeenCalled();

        vi.advanceTimersByTime(700);
        expect(collection.set).toHaveBeenCalledTimes(1);
        diagnostics.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears all diagnostics and cancels pending lints when disabled mid-session', () => {
      mockDiagnosticsConfig({ enabled: true });
      vi.useFakeTimers();
      try {
        let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
        let changeHandler: ((event: { document: vscode.TextDocument }) => void) | undefined;
        (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
          configHandler = handler;
          return { dispose: vi.fn() };
        });
        (vscode.workspace.onDidChangeTextDocument as Mock).mockImplementation((handler) => {
          changeHandler = handler;
          return { dispose: vi.fn() };
        });

        const diagnostics = newDiagnostics();
        const document = makeTscnDocument(VALID_TSCN);
        changeHandler!({ document });

        mockDiagnosticsConfig({ enabled: false });
        configHandler!({ affectsConfiguration: (section: string) => section === 'textscene.diagnostics' });

        expect(collection.clear).toHaveBeenCalledTimes(1);

        // The pending debounced lint from before the toggle must not fire.
        vi.advanceTimersByTime(1000);
        expect(collection.set).not.toHaveBeenCalled();
        diagnostics.dispose();
      } finally {
        vi.useRealTimers();
      }
    });

    it('re-lints open documents when re-enabled mid-session', () => {
      mockDiagnosticsConfig({ enabled: false });
      let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
        configHandler = handler;
        return { dispose: vi.fn() };
      });
      const document = makeTscnDocument(VALID_TSCN);
      (vscode.workspace as unknown as { textDocuments: vscode.TextDocument[] }).textDocuments = [document];

      const diagnostics = newDiagnostics();
      expect(collection.set).not.toHaveBeenCalled();

      mockDiagnosticsConfig({ enabled: true });
      configHandler!({ affectsConfiguration: (section: string) => section === 'textscene.diagnostics' });

      expect(collection.set).toHaveBeenCalledWith(document.uri, []);
      diagnostics.dispose();
    });

    it('ignores configuration changes unrelated to textscene.diagnostics', () => {
      mockDiagnosticsConfig({ enabled: true });
      let configHandler: ((event: vscode.ConfigurationChangeEvent) => void) | undefined;
      (vscode.workspace.onDidChangeConfiguration as Mock).mockImplementation((handler) => {
        configHandler = handler;
        return { dispose: vi.fn() };
      });

      const diagnostics = newDiagnostics();
      configHandler!({ affectsConfiguration: () => false });

      expect(collection.clear).not.toHaveBeenCalled();
      diagnostics.dispose();
    });
  });
});

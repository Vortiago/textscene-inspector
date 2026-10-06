/**
 * End-to-end tests over JSON-RPC: build the server bundle, spawn it, and speak LSP over its
 * stdio. A smoke test proves the framing and the capability wiring. The answer tests open the
 * shared fixture project and check every feature against `answers.json`, which the VS Code
 * suites check too, so both hosts give one answer for one position (ADR-0049).
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CompletionItemKind, SymbolKind } from 'vscode-languageserver/node';
import { beforeAll, describe, expect, it } from 'vitest';
import { cursorIn, loadAnswers, rangeTuple, sortedRanges, type CursorSpec } from '@textscene/dev-kit';
import { FIXTURE_DIR, PROJECT_DIR, projectText } from './languageFeatureAnswers.testkit';
import {
  BUILD_SERVER_COMMAND,
  repoRoot,
  spawnServer,
  withInitializedServer,
  type LspClient,
} from './lspClient.testkit';

const SCENE_URI = 'file:///scene.tscn';

const SCENE = `[gd_scene format=3]

[node name="Root" type="MeshInstance3D"]
visible = true
mesh = SubResource("missing")
`;

/**
 * One test: a server spawned, its handshake, and its answers, which a loaded runner finishes well
 * inside this. Each request and each awaited notification keeps the client's own shorter timeout.
 */
const SERVER_TIMEOUT_MS = 60_000;

interface LspRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

interface LspTextEdit {
  range: LspRange;
  newText: string;
}

interface LspSymbol {
  name: string;
  detail: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspSymbol[];
}

const answers = loadAnswers(FIXTURE_DIR);

beforeAll(() => {
  execSync(BUILD_SERVER_COMMAND, { cwd: repoRoot, stdio: 'pipe' });
}, 120_000);

describe('tscn-lsp end-to-end', () => {
  it(
    'initializes, hovers a class and returns the scene tree over stdio',
    async () => {
      await withInitializedServer(null, async (client) => {
        client.notify('textDocument/didOpen', {
          textDocument: { uri: SCENE_URI, languageId: 'tscn', version: 1, text: SCENE },
        });

        // The debounced lint pushes diagnostics. The scene's `SubResource("missing")` is one.
        const published = (await client.waitForNotification('textDocument/publishDiagnostics')) as {
          diagnostics: Array<{ message: string }>;
        };
        expect(published.diagnostics.length).toBeGreaterThan(0);

        const hover = await client.result<{ contents: { value: string } }>('textDocument/hover', {
          textDocument: { uri: SCENE_URI },
          position: { line: 2, character: 26 },
        });
        expect(hover.contents.value).toContain('Node3D');

        const tree = await client.result<LspSymbol[]>('textDocument/documentSymbol', {
          textDocument: { uri: SCENE_URI },
        });
        expect(tree.map((symbol) => symbol.name)).toEqual(['Root']);
        expect(tree[0]!.detail).toBe('MeshInstance3D');
      });
    },
    SERVER_TIMEOUT_MS
  );

  it(
    'announces every language feature in its capabilities',
    async () => {
      const { child, client } = spawnServer();
      try {
        const { capabilities } = await client.result<{ capabilities: Record<string, unknown> }>(
          'initialize',
          {
            processId: process.pid,
            rootUri: null,
            capabilities: {},
          }
        );
        expect(capabilities).toMatchObject({
          hoverProvider: true,
          completionProvider: { triggerCharacters: ['"', '=', '.', '/', '('] },
          codeActionProvider: { codeActionKinds: ['quickfix'] },
          foldingRangeProvider: true,
          documentSymbolProvider: true,
          definitionProvider: true,
          documentHighlightProvider: true,
          documentLinkProvider: { resolveProvider: false },
        });
      } finally {
        child.kill();
      }
    },
    SERVER_TIMEOUT_MS
  );
});

/** The URI of a file in a project directory, as a client sends it. */
function fileUri(projectDir: string, file: string): string {
  return pathToFileURL(join(projectDir, file)).toString();
}

/** A project-relative path with forward slashes, so an answer reads the same on Windows. */
function projectPath(projectDir: string, uri: string): string {
  return relative(projectDir, fileURLToPath(uri)).split(sep).join('/');
}

/** Opens a committed project file in the server and returns its URI. */
function open(client: LspClient, projectDir: string, file: string): string {
  const uri = fileUri(projectDir, file);
  client.notify('textDocument/didOpen', {
    textDocument: { uri, languageId: 'tscn', version: 1, text: projectText(file) },
  });
  return uri;
}

/** Opens the file a cursor names and returns the request params for that cursor. */
function openAt(client: LspClient, at: CursorSpec, projectDir = PROJECT_DIR) {
  const uri = open(client, projectDir, at.file);
  return { textDocument: { uri }, position: cursorIn(projectText(at.file).split('\n'), at) };
}

/** Runs `use` against a fresh server rooted at the committed fixture project. */
function inProject(use: (client: LspClient) => Promise<void>): Promise<void> {
  return withInitializedServer(pathToFileURL(PROJECT_DIR).toString(), use);
}

function labelsOf(items: ReadonlyArray<{ label: string }> | null): string[] {
  return (items ?? []).map((item) => item.label);
}

/** `text` with each edit applied, the last first, so an earlier edit keeps its offsets. */
function applyEdits(text: string, edits: readonly LspTextEdit[]): string {
  const lines = text.split('\n');
  const offsetOf = (position: { line: number; character: number }) =>
    lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
  const ordered = [...edits].sort((a, b) => offsetOf(b.range.start) - offsetOf(a.range.start));
  return ordered.reduce(
    (current, edit) =>
      current.slice(0, offsetOf(edit.range.start)) + edit.newText + current.slice(offsetOf(edit.range.end)),
    text
  );
}

/** Every symbol of the tree, each before its children, as the outline lists them. */
function flatten(symbols: readonly LspSymbol[]): LspSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children ?? [])]);
}

/** An enum member's value by the name `answers.json` gives it. */
function kindNamed(kinds: Record<string, number>, name: string): number {
  const value = kinds[name];
  if (value === undefined) throw new Error(`expected a kind named ${name}, found none`);
  return value;
}

function outlineOf(symbols: readonly LspSymbol[], depth = 0): string[] {
  return symbols.flatMap((symbol) => [
    `${'  '.repeat(depth)}${symbol.name}: ${symbol.detail}`,
    ...outlineOf(symbol.children ?? [], depth + 1),
  ]);
}

describe('tscn-lsp gives the shared answers for the fixture project', () => {
  for (const answer of answers.hover) {
    it(
      `hover: ${answer.name}`,
      () =>
        inProject(async (client) => {
          const hover = await client.result<{ contents: { value: string }; range: LspRange } | null>(
            'textDocument/hover',
            openAt(client, answer.at)
          );
          if (answer.markdown === null) {
            expect(hover).toBeNull();
            return;
          }
          expect(hover?.contents.value).toBe(answer.markdown);
          expect(hover && rangeTuple(hover.range)).toEqual(answer.range);
        }),
      SERVER_TIMEOUT_MS
    );
  }

  for (const answer of answers.completion) {
    it(
      `completion: ${answer.name}`,
      () =>
        inProject(async (client) => {
          const items = await client.result<Array<{ label: string; kind?: number }>>(
            'textDocument/completion',
            openAt(client, answer.at)
          );
          const labels = labelsOf(items);
          if (answer.kind) {
            const kind = kindNamed(CompletionItemKind as unknown as Record<string, number>, answer.kind);
            expect(items.filter((item) => item.kind !== kind).map((item) => item.label)).toEqual([]);
          }
          if (answer.exactly) expect([...labels].sort()).toEqual([...answer.exactly].sort());
          for (const label of answer.includes ?? []) expect(labels).toContain(label);
          for (const label of answer.excludes ?? []) expect(labels).not.toContain(label);
        }),
      SERVER_TIMEOUT_MS
    );
  }

  for (const answer of answers.definition) {
    it(
      `definition: ${answer.name}`,
      () =>
        inProject(async (client) => {
          const location = await client.result<{ uri: string; range: LspRange } | null>(
            'textDocument/definition',
            openAt(client, answer.at)
          );
          const targets =
            location === null
              ? []
              : [{ file: projectPath(PROJECT_DIR, location.uri), range: rangeTuple(location.range) }];
          expect(targets).toEqual(answer.targets);
        }),
      SERVER_TIMEOUT_MS
    );
  }

  for (const answer of answers.highlights) {
    it(
      `highlights: ${answer.name}`,
      () =>
        inProject(async (client) => {
          const highlights = await client.result<Array<{ range: LspRange }>>(
            'textDocument/documentHighlight',
            openAt(client, answer.at)
          );
          expect(sortedRanges(highlights.map((highlight) => rangeTuple(highlight.range)))).toEqual(
            sortedRanges(answer.ranges)
          );
        }),
      SERVER_TIMEOUT_MS
    );
  }

  it(
    'folding: one fold per node and resource body',
    () =>
      inProject(async (client) => {
        const uri = open(client, PROJECT_DIR, answers.folding.file);
        const ranges = await client.result<Array<{ startLine: number; endLine: number }>>(
          'textDocument/foldingRange',
          { textDocument: { uri } }
        );
        expect(ranges.map((range) => [range.startLine, range.endLine])).toEqual(answers.folding.ranges);
      }),
    SERVER_TIMEOUT_MS
  );

  it(
    'links: every res:// path links to its file under the project root',
    () =>
      inProject(async (client) => {
        const uri = open(client, PROJECT_DIR, answers.links.file);
        const links = await client.result<Array<{ range: LspRange; target?: string }>>(
          'textDocument/documentLink',
          { textDocument: { uri } }
        );
        expect(
          links.map((link) => ({
            range: rangeTuple(link.range),
            target: link.target === undefined ? null : projectPath(PROJECT_DIR, link.target),
          }))
        ).toEqual(answers.links.links);
      }),
    SERVER_TIMEOUT_MS
  );

  it(
    'symbols: the outline nests each node under its parent',
    () =>
      inProject(async (client) => {
        const uri = open(client, PROJECT_DIR, answers.symbols.file);
        const symbols = await client.result<LspSymbol[]>('textDocument/documentSymbol', {
          textDocument: { uri },
        });
        expect(outlineOf(symbols)).toEqual(answers.symbols.outline);
      }),
    SERVER_TIMEOUT_MS
  );

  it(
    "symbols: each node's range covers its subtree, and its selection is its heading",
    () =>
      inProject(async (client) => {
        const uri = open(client, PROJECT_DIR, answers.symbols.file);
        const symbols = await client.result<LspSymbol[]>('textDocument/documentSymbol', {
          textDocument: { uri },
        });
        expect(
          flatten(symbols).map((symbol) => ({
            name: symbol.name,
            kind: symbol.kind,
            range: rangeTuple(symbol.range),
            selectionRange: rangeTuple(symbol.selectionRange),
          }))
        ).toEqual(
          answers.symbols.symbols.map((symbol) => ({
            ...symbol,
            kind: kindNamed(SymbolKind as unknown as Record<string, number>, symbol.kind),
          }))
        );
      }),
    SERVER_TIMEOUT_MS
  );

  it(
    `quick fix: ${answers.quickFix.name}, and its edit writes the engine spelling`,
    () =>
      inProject(async (client) => {
        const { at, title, fixedLine } = answers.quickFix;
        const { textDocument, position } = openAt(client, at);
        const actions = await client.result<
          Array<{ title: string; edit: { changes: Record<string, LspTextEdit[]> } }>
        >('textDocument/codeAction', {
          textDocument,
          range: { start: position, end: position },
          context: { diagnostics: [] },
        });
        const fix = actions.find((action) => action.title === title);
        expect(fix, `expected "${title}" among ${JSON.stringify(actions.map((a) => a.title))}`).toBeDefined();

        const fixed = applyEdits(projectText(at.file), fix!.edit.changes[textDocument.uri] ?? []);
        expect(fixed.split('\n')[position.line]).toBe(fixedLine);
      }),
    SERVER_TIMEOUT_MS
  );

  for (const answer of answers.diagnostics) {
    it(
      `diagnostics: ${answer.file} reports ${answer.codes.length === 0 ? 'nothing' : answer.codes.join(', ')}`,
      () =>
        inProject(async (client) => {
          const uri = open(client, PROJECT_DIR, answer.file);
          const published = (await client.waitFor(
            'textDocument/publishDiagnostics',
            (params) => (params as { uri: string }).uri === uri
          )) as { diagnostics: Array<{ code: string }> };
          expect(published.diagnostics.map((diagnostic) => diagnostic.code).sort()).toEqual(
            [...answer.codes].sort()
          );
        }),
      SERVER_TIMEOUT_MS
    );
  }
});

describe('tscn-lsp path completion through a symlinked directory', () => {
  /**
   * A copy of the project with `props/` linked to a directory outside it, and `props/back`
   * linked to the project root. A junction on Windows, which needs no administrator right.
   */
  function linkedProject(): { root: string; projectDir: string } {
    const root = mkdtempSync(join(tmpdir(), 'tscn-lsp-links-'));
    const projectDir = join(root, 'project');
    cpSync(PROJECT_DIR, projectDir, { recursive: true });
    const outside = join(root, 'outside', 'props');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'crate.tres'), '[gd_resource type="BoxMesh" format=3]\n\n[resource]\n');
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(outside, join(projectDir, 'props'), linkType);
    symlinkSync(projectDir, join(outside, 'back'), linkType);
    return { root, projectDir };
  }

  it(
    'offers a file behind the link, and a link back up the tree ends the walk',
    async () => {
      const { root, projectDir } = linkedProject();
      try {
        await withInitializedServer(pathToFileURL(projectDir).toString(), async (client) => {
          const at = answers.completion.find((answer) => answer.at.after === '"res://')!.at;
          const labels = labelsOf(
            await client.result<Array<{ label: string }>>(
              'textDocument/completion',
              openAt(client, at, projectDir)
            )
          );
          expect(labels).toContain('res://props/crate.tres');
          expect(labels.filter((label) => label.startsWith('res://props/back/'))).toEqual([]);
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    SERVER_TIMEOUT_MS
  );
});

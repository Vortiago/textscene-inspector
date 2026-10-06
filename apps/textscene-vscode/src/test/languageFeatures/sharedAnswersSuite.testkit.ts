/**
 * The language features a user reaches in a `.tscn` editor, called through VS Code's own
 * `vscode.execute*` commands and checked against the shared `answers.json`. The `tscn-lsp`
 * end-to-end test checks the same answers over JSON-RPC, so a pass in both proves the two
 * hosts agree. The integration suite and the installed-package suite both define it.
 */

import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { EXTENSION_ID } from '../smokeProject/sceneEditor';
import { waitFor } from '../waitFor';
import {
  copyFixtureProject,
  cursorIn,
  removeFixtureProject,
  loadAnswers,
  projectPath,
  rangeTuple,
  sortedRanges,
  type CursorSpec,
} from './answers';

/** A lint reaches the Problems panel well inside this on a loaded runner. */
const LINT_TIMEOUT_MS = 10000;

/** The plain text of a hover's contents, whichever shape the provider returned. */
export function hoverText(hovers: readonly vscode.Hover[]): string {
  return hovers
    .flatMap((hover) => hover.contents)
    .map((part) => (typeof part === 'string' ? part : part.value))
    .join('\n');
}

function labelOf(item: vscode.CompletionItem): string {
  return typeof item.label === 'string' ? item.label : item.label.label;
}

/** Every symbol of the tree, each before its children, as the Outline lists them. */
function flatten(symbols: readonly vscode.DocumentSymbol[]): vscode.DocumentSymbol[] {
  return symbols.flatMap((symbol) => [symbol, ...flatten(symbol.children)]);
}

/** An enum member's value by the name `answers.json` gives it. */
function kindNamed(kinds: object, name: string): number {
  const value = (kinds as Record<string, unknown>)[name];
  if (typeof value !== 'number') throw new Error(`expected a kind named ${name}, found none`);
  return value;
}

function outlineOf(symbols: readonly vscode.DocumentSymbol[], depth = 0): string[] {
  return symbols.flatMap((symbol) => [
    `${'  '.repeat(depth)}${symbol.name}: ${symbol.detail}`,
    ...outlineOf(symbol.children, depth + 1),
  ]);
}

/** A `Location` or a `LocationLink` as the file and range it targets. */
function targetOf(projectDir: string, found: vscode.Location | vscode.LocationLink) {
  const uri = 'targetUri' in found ? found.targetUri : found.uri;
  const range = 'targetUri' in found ? (found.targetSelectionRange ?? found.targetRange) : found.range;
  return { file: projectPath(projectDir, uri.fsPath), range: rangeTuple(range) };
}

/** The tscn-lint codes on `uri`, sorted. */
function lintCodes(uri: vscode.Uri): string[] {
  return vscode.languages
    .getDiagnostics(uri)
    .filter((diagnostic) => diagnostic.source === 'tscn-lint')
    .map((diagnostic) => String(diagnostic.code))
    .sort();
}

/**
 * Defines the suite against a copy of the fixture project at `projectDir`, which must lie
 * inside the window's workspace folder so `res://` resolves against it.
 */
export function defineSharedAnswersSuite(projectDir: string): void {
  const answers = loadAnswers();
  const uriOf = (file: string) => vscode.Uri.file(path.join(projectDir, file));
  const documentOf = (file: string) => vscode.workspace.openTextDocument(uriOf(file));
  const openAt = async (at: CursorSpec) => {
    const document = await documentOf(at.file);
    return { document, position: cursorIn(document, at) };
  };

  suite('Shared language-feature answers', () => {
    /**
     * Each URI the Problems panel has received a lint for, written only by `diagnosticsListener`.
     * It tells an empty answer from a lint that has not run yet.
     */
    const linted = new Set<string>();
    let diagnosticsListener: vscode.Disposable | undefined;

    suiteSetup(async () => {
      diagnosticsListener = vscode.languages.onDidChangeDiagnostics((event) => {
        for (const uri of event.uris) linted.add(uri.toString());
      });
      await copyFixtureProject(projectDir);
      await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    });

    suiteTeardown(async () => {
      diagnosticsListener?.dispose();
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await removeFixtureProject(projectDir);
    });

    for (const answer of answers.hover) {
      test(`hover: ${answer.name}`, async () => {
        const { document, position } = await openAt(answer.at);
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          position
        );

        if (answer.markdown === null) {
          assert.deepStrictEqual(hovers, [], 'the position has no hover');
          return;
        }
        assert.strictEqual(hoverText(hovers), answer.markdown);
        assert.deepStrictEqual(hovers[0]?.range && rangeTuple(hovers[0].range), answer.range);
      });
    }

    for (const answer of answers.completion) {
      test(`completion: ${answer.name}`, async () => {
        const { document, position } = await openAt(answer.at);
        const list = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          position
        );
        const labels = list.items.map(labelOf);
        if (answer.kind) {
          const kind = kindNamed(vscode.CompletionItemKind, answer.kind);
          assert.deepStrictEqual(list.items.filter((item) => item.kind !== kind).map(labelOf), []);
        }

        if (answer.exactly) assert.deepStrictEqual([...labels].sort(), [...answer.exactly].sort());
        for (const label of answer.includes ?? []) assert.ok(labels.includes(label), `${label} is offered`);
        for (const label of answer.excludes ?? [])
          assert.ok(!labels.includes(label), `${label} is not offered`);
        if (answer.replaces) {
          assert.deepStrictEqual(
            list.items.map((item) => item.range instanceof vscode.Range && rangeTuple(item.range)),
            list.items.map(() => answer.replaces)
          );
        }
      });
    }

    for (const answer of answers.definition) {
      test(`definition: ${answer.name}`, async () => {
        const { document, position } = await openAt(answer.at);
        const found = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
          'vscode.executeDefinitionProvider',
          document.uri,
          position
        );

        assert.deepStrictEqual(
          found.map((target) => targetOf(projectDir, target)),
          answer.targets
        );
      });
    }

    for (const answer of answers.highlights) {
      test(`highlights: ${answer.name}`, async () => {
        const { document, position } = await openAt(answer.at);
        // VS Code 1.85 answers undefined, not an empty list, when no provider highlights anything.
        const highlights =
          (await vscode.commands.executeCommand<vscode.DocumentHighlight[] | undefined>(
            'vscode.executeDocumentHighlights',
            document.uri,
            position
          )) ?? [];

        assert.deepStrictEqual(
          sortedRanges(highlights.map((highlight) => rangeTuple(highlight.range))),
          sortedRanges(answer.ranges)
        );
      });
    }

    test('folding: one fold per node and resource body', async () => {
      const document = await documentOf(answers.folding.file);
      const ranges = await vscode.commands.executeCommand<vscode.FoldingRange[]>(
        'vscode.executeFoldingRangeProvider',
        document.uri
      );

      assert.deepStrictEqual(
        ranges.map((range) => [range.start, range.end]),
        answers.folding.ranges
      );
    });

    test('links: every res:// path links to its file under the project root', async () => {
      const document = await documentOf(answers.links.file);
      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        'vscode.executeLinkProvider',
        document.uri,
        // Resolve every link, as a hover or a click does.
        Number.MAX_SAFE_INTEGER
      );

      assert.deepStrictEqual(
        links.map((link) => ({
          range: rangeTuple(link.range),
          target: link.target ? projectPath(projectDir, link.target.fsPath) : null,
        })),
        answers.links.links
      );
    });

    test('symbols: the Outline nests each node under its parent', async () => {
      const document = await documentOf(answers.symbols.file);
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      assert.deepStrictEqual(outlineOf(symbols), answers.symbols.outline);
    });

    test("symbols: each node's range covers its subtree, and its selection is its heading", async () => {
      const document = await documentOf(answers.symbols.file);
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      assert.deepStrictEqual(
        flatten(symbols).map((symbol) => ({
          name: symbol.name,
          kind: symbol.kind,
          range: rangeTuple(symbol.range),
          selectionRange: rangeTuple(symbol.selectionRange),
        })),
        answers.symbols.symbols.map((symbol) => ({
          ...symbol,
          kind: kindNamed(vscode.SymbolKind, symbol.kind),
        }))
      );
    });

    test(`quick fix: ${answers.quickFix.name}, and applying it writes the engine spelling`, async () => {
      const { at, title, fixedLine } = answers.quickFix;
      const committed = await documentOf(at.file);
      // An untitled copy, so applying the edit leaves the project file as the other tests read it.
      const document = await vscode.workspace.openTextDocument({
        language: 'tscn',
        content: committed.getText(),
      });
      const position = cursorIn(document, at);
      const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
        'vscode.executeCodeActionProvider',
        document.uri,
        new vscode.Range(position, position)
      );
      const fix = actions.find((action) => action.title === title);
      assert.ok(
        fix?.edit,
        `expected "${title}" with an edit, found ${JSON.stringify(actions.map((a) => a.title))}`
      );

      assert.ok(await vscode.workspace.applyEdit(fix.edit), 'VS Code applies the edit');

      assert.strictEqual(document.lineAt(position.line).text, fixedLine);
    });

    for (const answer of answers.diagnostics) {
      const reports = answer.codes.length === 0 ? 'nothing' : answer.codes.join(', ');
      test(`diagnostics: ${answer.file} reports ${reports} in the Problems panel`, async () => {
        const uri = uriOf(answer.file);
        await vscode.window.showTextDocument(uri);
        await waitFor(
          () => linted.has(uri.toString()),
          LINT_TIMEOUT_MS,
          () => `no lint reached the Problems panel for ${uri.fsPath}`
        );

        // The file-local lint publishes first and the cross-file lint after it, so wait for the answer.
        const expected = JSON.stringify([...answer.codes].sort());
        await waitFor(
          () => JSON.stringify(lintCodes(uri)) === expected,
          LINT_TIMEOUT_MS,
          () => `expected ${expected} on ${answer.file}, found ${JSON.stringify(lintCodes(uri))}`
        );
      });
    }
  });
}

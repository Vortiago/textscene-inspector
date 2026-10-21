/**
 * The quick fixes VS Code answers for a range in an extension host suite. Every suite asks for
 * them here, so each one survives the request VS Code cancels on its own.
 */

import * as vscode from 'vscode';

/** Ten seconds bounds a provider that never answers. A cancelled request costs only one more ask. */
const ANSWER_TIMEOUT_MS = 10000;
const ASK_INTERVAL_MS = 50;

/**
 * The quick fixes for `range`, asked again until `isAnswer` holds or the time runs out, then the
 * last answer. VS Code 1.85 cancels a code-action request when a provider registers for the
 * document mid-request, as a built-in `*` provider does once a session, and the command then
 * answers an empty list (`getCodeActions`, `editor/contrib/codeAction/browser/codeAction.ts`).
 */
export async function quickFixesAt(
  uri: vscode.Uri,
  range: vscode.Range,
  isAnswer: (fixes: readonly vscode.CodeAction[]) => boolean
): Promise<vscode.CodeAction[]> {
  const deadline = Date.now() + ANSWER_TIMEOUT_MS;
  for (;;) {
    const fixes = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      uri,
      range
    );
    if (isAnswer(fixes) || Date.now() >= deadline) return fixes;
    await new Promise((resolve) => setTimeout(resolve, ASK_INTERVAL_MS));
  }
}

/**
 * Bridges the language-feature engine's host-neutral ranges to VS Code's. Both count
 * lines and characters from zero, so the conversion is a construction, not an
 * arithmetic. A `vscode.Position` or `vscode.Range` already satisfies the engine's
 * structural types, so only this direction needs one.
 */

import * as vscode from 'vscode';
import type { Range as EngineRange } from '@textscene/core/languageFeatures';

export function toVscodeRange(range: EngineRange): vscode.Range {
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.character),
    new vscode.Position(range.end.line, range.end.character)
  );
}

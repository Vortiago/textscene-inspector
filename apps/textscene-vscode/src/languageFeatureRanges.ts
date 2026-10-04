/**
 * Bridges the language-feature engine's host-neutral positions to VS Code's. Both
 * count lines and characters from zero, so the conversion is a construction, not an
 * arithmetic: it exists only to name the right class on each side.
 */

import * as vscode from 'vscode';
import type { Position as EnginePosition, Range as EngineRange } from '@textscene/core/languageFeatures';

export function toEnginePosition(position: vscode.Position): EnginePosition {
  return { line: position.line, character: position.character };
}

export function toEngineRange(range: vscode.Range): EngineRange {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  };
}

export function toVscodeRange(range: EngineRange): vscode.Range {
  return new vscode.Range(
    new vscode.Position(range.start.line, range.start.character),
    new vscode.Position(range.end.line, range.end.character)
  );
}

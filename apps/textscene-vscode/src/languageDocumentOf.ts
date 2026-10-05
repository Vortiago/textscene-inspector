/**
 * The engine's model of an open `.tscn`, parsed once per document version. Hover,
 * highlight, folding, code actions and completion all ask for it after one edit, and
 * highlight and code actions ask again on each cursor move.
 */

import type * as vscode from 'vscode';
import { createLanguageDocument, type LanguageDocument } from '@textscene/core/languageFeatures';

/** Written only by `languageDocumentOf`. A WeakMap lets a closed document be collected. */
const modelByDocument = new WeakMap<
  vscode.TextDocument,
  { readonly version: number; readonly model: LanguageDocument }
>();

/** The model of `document` at its current version. */
export function languageDocumentOf(document: vscode.TextDocument): LanguageDocument {
  const cached = modelByDocument.get(document);
  if (cached !== undefined && cached.version === document.version) return cached.model;
  const model = createLanguageDocument(document.getText());
  modelByDocument.set(document, { version: document.version, model });
  return model;
}

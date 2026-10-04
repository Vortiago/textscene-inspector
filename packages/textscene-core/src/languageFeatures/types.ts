/**
 * The host-neutral result types a language feature returns. Positions and ranges are
 * zero-based, the convention LSP and the VS Code API share, so a host adapts nothing.
 * The {@link LanguageDocument} model keeps the parser's one-based line numbers. The
 * boundary converts, so only this file decides which side a range lives on.
 */

/** A zero-based line and character, as LSP and VS Code count them. */
export interface Position {
  readonly line: number;
  readonly character: number;
}

/** A zero-based range. */
export interface Range {
  readonly start: Position;
  readonly end: Position;
}

/** What a completion offers, so a host picks an icon. */
export type CompletionKind =
  'nodeType' | 'resourceType' | 'property' | 'value' | 'resourceId' | 'path' | 'nodeName';

/** One completion. `insertText` defaults to `label`. */
export interface CompletionItem {
  readonly label: string;
  readonly kind: CompletionKind;
  /** A short right-hand annotation, such as a variant type or a declaring class. */
  readonly detail?: string;
  readonly documentation?: string;
  readonly insertText?: string;
  /** A deprecated property spelling, shown struck through. */
  readonly deprecated?: boolean;
}

/** Hover content and the range it applies to. */
export interface Hover {
  readonly markdown: string;
  readonly range?: Range;
}

export type CodeActionKind = 'quickfix';

/** One edit, with the range replaced by `newText`. */
export interface TextEdit {
  readonly range: Range;
  readonly newText: string;
}

/** A code action that applies one set of edits. */
export interface CodeAction {
  readonly title: string;
  readonly kind: CodeActionKind;
  readonly edit: readonly TextEdit[];
}

/** A foldable block. LSP and VS Code count these lines from zero. */
export interface FoldingRange {
  readonly startLine: number;
  readonly endLine: number;
  readonly kind?: 'region' | 'comment';
}

/** A highlighted span, for one id under the cursor. */
export interface DocumentHighlight {
  readonly range: Range;
}

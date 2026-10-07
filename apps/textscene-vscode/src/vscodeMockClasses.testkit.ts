/// <reference types="vitest/globals" />

/**
 * The constructible classes and enums of the `vscode` module mock. Nothing here
 * holds a spy: the namespaces `afterEach` clears live in `vscodeMocks.testkit.ts`,
 * and `vscodeModuleMock.testkit.ts` assembles both.
 */

import { vi } from 'vitest';

/** Takes two positions, or four numbers as the real `Range` does, and holds two positions. */
export class MockRange {
  public start: any;
  public end: any;

  constructor(...args: any[]) {
    if (args.length === 4) {
      this.start = new MockPosition(args[0], args[1]);
      this.end = new MockPosition(args[2], args[3]);
    } else {
      [this.start, this.end] = args;
    }
  }
}

export class MockPosition {
  constructor(
    public line: number,
    public character: number
  ) {}
}

export class MockSelection {
  constructor(
    public start: any,
    public end: any
  ) {}
}

export class MockEventEmitter {
  private listeners: Array<(...args: any[]) => void> = [];

  // The real `vscode.Event` is `(listener, thisArgs?, disposables?)` and pushes
  // the subscription it returns into `disposables`. A one-argument mock leaves
  // every `_disposables` array a caller passes empty.
  event = (
    listener: (...args: any[]) => void,
    thisArgs?: any,
    disposables?: Array<{ dispose: () => void }>
  ): { dispose: ReturnType<typeof vi.fn> } => {
    const bound = thisArgs == null ? listener : listener.bind(thisArgs);
    this.listeners.push(bound);
    const subscription = {
      dispose: vi.fn(() => {
        const index = this.listeners.indexOf(bound);
        if (index !== -1) this.listeners.splice(index, 1);
      }),
    };
    disposables?.push(subscription);
    return subscription;
  };

  fire(...args: any[]) {
    this.listeners.forEach((listener) => listener(...args));
  }

  dispose() {
    this.listeners = [];
  }
}

/** Refuses an empty name, as the real constructor's `validate` does. */
export class MockDocumentSymbol {
  children: MockDocumentSymbol[] = [];

  constructor(
    public name: string,
    public detail: string,
    public kind: number,
    public range: any,
    public selectionRange: any
  ) {
    if (!name) throw new Error('name must not be falsy');
  }
}

export class MockLocation {
  constructor(
    public uri: any,
    public range: any
  ) {}
}

export class MockDocumentLink {
  target?: unknown;
  tooltip?: string;

  constructor(
    public range: any,
    target?: unknown
  ) {
    this.target = target;
  }
}

export class MockDiagnostic {
  code?: string | number;
  source?: string;

  constructor(
    public range: any,
    public message: string,
    public severity?: number
  ) {}
}

export const MockDiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
} as const;

/** `vscode.RelativePattern`: a glob matched under a base folder. */
export class MockRelativePattern {
  constructor(
    public readonly baseUri: any,
    public readonly pattern: string
  ) {}
}

/** `vscode.TabInputText`: the input of a tab that shows a text document. */
export class MockTabInputText {
  constructor(public readonly uri: any) {}
}

export const MockViewColumn = {
  One: 1,
  Two: 2,
  Three: 3,
  Active: -1,
  Beside: -2,
};

export const MockFileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64,
};

export const MockTextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3,
};

/** A numeric enum, as the real one is, so it maps a kind back to its name. */
export enum MockSymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

/** `vscode.MarkdownString`: hover and documentation content. */
export class MockMarkdownString {
  constructor(public value: string) {}
}

/** `vscode.Hover`: markdown content and the range it applies to. */
export class MockHover {
  constructor(
    public contents: any,
    public range?: any
  ) {}
}

/** `vscode.CompletionItem`: the fields the providers set. */
export class MockCompletionItem {
  detail?: any;
  documentation?: any;
  insertText?: any;
  tags?: number[];
  range?: any;

  constructor(
    public label: string,
    public kind?: number
  ) {}
}

export const MockCompletionItemTag = {
  Deprecated: 1,
};

export const MockCompletionItemKind = {
  Text: 0,
  Method: 1,
  Function: 2,
  Constructor: 3,
  Field: 4,
  Variable: 5,
  Class: 6,
  Interface: 7,
  Module: 8,
  Property: 9,
  Unit: 10,
  Value: 11,
  Enum: 12,
  Keyword: 13,
  Snippet: 14,
  Color: 15,
  File: 16,
  Reference: 17,
  Folder: 18,
  EnumMember: 19,
  Constant: 20,
  Struct: 21,
  Event: 22,
  Operator: 23,
  TypeParameter: 24,
};

/** `vscode.CodeAction`: a title, a kind and the edit it applies. */
export class MockCodeAction {
  edit?: MockWorkspaceEdit;

  constructor(
    public title: string,
    public kind?: any
  ) {}
}

export const MockCodeActionKind = {
  Empty: '',
  QuickFix: 'quickfix',
  Refactor: 'refactor',
  RefactorExtract: 'refactor.extract',
  RefactorInline: 'refactor.inline',
  RefactorRewrite: 'refactor.rewrite',
  Source: 'source',
  SourceOrganizeImports: 'source.organizeImports',
};

/** `vscode.WorkspaceEdit`: enough to record the replaces a code action applies. */
export class MockWorkspaceEdit {
  readonly replaces: Array<{ uri: any; range: any; newText: string }> = [];

  replace(uri: any, range: any, newText: string): boolean {
    this.replaces.push({ uri, range, newText });
    return true;
  }
}

/** `vscode.FoldingRange`: a pair of zero-based lines. */
export class MockFoldingRange {
  constructor(
    public start: number,
    public end: number,
    public kind?: any
  ) {}
}

export const MockFoldingRangeKind = {
  Comment: 1,
  Imports: 2,
  Region: 3,
};

/** `vscode.DocumentHighlight`: a range and its read/write kind. */
export class MockDocumentHighlight {
  constructor(
    public range: any,
    public kind?: number
  ) {}
}

export const MockDocumentHighlightKind = {
  Text: 0,
  Read: 1,
  Write: 2,
};

/** `vscode.LanguageModelTextPart`: one text part of a tool result. */
export class MockLanguageModelTextPart {
  constructor(public value: string) {}
}

/** `vscode.LanguageModelDataPart`: a binary tool-result part, such as a PNG. */
export class MockLanguageModelDataPart {
  static image(data: Uint8Array, mimeType: string): MockLanguageModelDataPart {
    return new MockLanguageModelDataPart(data, mimeType);
  }

  constructor(
    public data: Uint8Array,
    public mimeType: string
  ) {}
}

/** `vscode.LanguageModelToolResult`: the parts a tool returns. */
export class MockLanguageModelToolResult {
  constructor(public content: any[]) {}
}

/// <reference types="vitest/globals" />

/**
 * The constructible classes and enums of the `vscode` module mock. Nothing here
 * holds a spy: the namespaces `afterEach` clears live in `vscodeMocks.testkit.ts`,
 * and `test-setup.ts` assembles both.
 */

import { vi } from 'vitest';

export class MockRange {
  constructor(
    public start: any,
    public end: any
  ) {}
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
    this.listeners.forEach(listener => listener(...args));
  }

  dispose() {
    this.listeners = [];
  }
}

export class MockDocumentSymbol {
  children: MockDocumentSymbol[] = [];

  constructor(
    public name: string,
    public detail: string,
    public kind: number,
    public range: any,
    public selectionRange: any
  ) {}
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
  Hint: 3
} as const;

/** `vscode.TabInputText`: the input of a tab that shows a text document. */
export class MockTabInputText {
  constructor(public readonly uri: any) {}
}

export const MockViewColumn = {
  One: 1,
  Two: 2,
  Three: 3,
  Active: -1,
  Beside: -2
};

export const MockFileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64
};

export const MockTextEditorRevealType = {
  Default: 0,
  InCenter: 1,
  InCenterIfOutsideViewport: 2,
  AtTop: 3
};

export const MockSymbolKind: Record<string, number> = {
  File: 0,
  Module: 1,
  Namespace: 2,
  Package: 3,
  Class: 4,
  Method: 5,
  Property: 6,
  Field: 7,
  Constructor: 8,
  Enum: 9,
  Interface: 10,
  Function: 11,
  Variable: 12,
  Constant: 13,
  String: 14,
  Number: 15,
  Boolean: 16,
  Array: 17,
  Object: 18,
  Key: 19,
  Null: 20,
  EnumMember: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25
};

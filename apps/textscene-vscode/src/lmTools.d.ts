/**
 * `LanguageModelDataPart`, a binary part of a tool result such as a PNG the agent can look at.
 * It is stable from VS Code 1.106, and the pinned `@types/vscode` 1.105 predates it. The capture
 * tool registers only on a host that returns one (see `hostReturnsImageParts`).
 */

declare module 'vscode' {
  export class LanguageModelDataPart {
    static image(data: Uint8Array, mime: string): LanguageModelDataPart;
    mimeType: string;
    data: Uint8Array;
    constructor(data: Uint8Array, mimeType: string);
  }
}

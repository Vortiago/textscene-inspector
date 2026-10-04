/**
 * The Language Model Tools API (`vscode.lm.registerTool`, `LanguageModelToolResult`),
 * which the pinned `@types/vscode` 1.85 predates. Only the members these tools use are
 * declared, so the extension compiles against 1.85 while registering tools on a VS Code
 * that has the API. `registerTscnTools` guards the call at runtime.
 */

declare module 'vscode' {
  export namespace lm {
    /**
     * Registers a tool a language model may invoke. The tool must also be listed in the
     * extension's `languageModelTools` contribution.
     */
    export function registerTool<T>(name: string, tool: LanguageModelTool<T>): Disposable;

    /** Every tool registered by every extension, so a host can list them. */
    export const tools: readonly LanguageModelToolInformation[];

    /** Invokes a registered tool, as an integration test does to prove one end to end. */
    export function invokeTool<T>(
      name: string,
      options: LanguageModelToolInvocationOptions<T>,
      token?: CancellationToken
    ): Thenable<LanguageModelToolResult>;
  }

  export interface LanguageModelToolInformation {
    readonly name: string;
  }

  export interface LanguageModelToolInvocationOptions<T> {
    readonly input: T;
  }

  export interface LanguageModelToolInvocationPrepareOptions<T> {
    readonly input: T;
  }

  export interface PreparedToolInvocation {
    invocationMessage?: string | MarkdownString;
  }

  export interface LanguageModelTool<T> {
    invoke(
      options: LanguageModelToolInvocationOptions<T>,
      token: CancellationToken
    ): ProviderResult<LanguageModelToolResult>;
    prepareInvocation?(
      options: LanguageModelToolInvocationPrepareOptions<T>,
      token: CancellationToken
    ): ProviderResult<PreparedToolInvocation>;
  }

  export class LanguageModelTextPart {
    value: string;
    constructor(value: string);
  }

  /**
   * A binary part of a tool result, such as a PNG the agent can look at. `image` builds
   * the one this extension returns; it is stable from VS Code 1.106, so a tool that
   * returns one guards on {@link LanguageModelDataPart}'s presence.
   */
  export class LanguageModelDataPart {
    static image(data: Uint8Array, mime: string): LanguageModelDataPart;
    mimeType: string;
    data: Uint8Array;
    constructor(data: Uint8Array, mimeType: string);
  }

  export class LanguageModelToolResult {
    content: Array<LanguageModelTextPart | LanguageModelDataPart | unknown>;
    constructor(content: Array<LanguageModelTextPart | LanguageModelDataPart>);
  }
}

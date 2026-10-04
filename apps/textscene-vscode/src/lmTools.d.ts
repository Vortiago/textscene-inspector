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

  export class LanguageModelToolResult {
    content: Array<LanguageModelTextPart | unknown>;
    constructor(content: Array<LanguageModelTextPart>);
  }
}

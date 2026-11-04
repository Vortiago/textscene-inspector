/** Invokes a registered agent tool on a scene, as an agent chat does outside a chat request. */
import * as vscode from 'vscode';

/** No chat request exists in a test, so the invocation token is undefined. */
export function invokeSceneTool(tool: string, scenePath: string): Thenable<vscode.LanguageModelToolResult> {
  return vscode.lm.invokeTool(tool, { input: { path: scenePath }, toolInvocationToken: undefined });
}

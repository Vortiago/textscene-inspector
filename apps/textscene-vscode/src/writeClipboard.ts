/** The extension host's one clipboard write, for the copy command and the preview panel. */

import * as vscode from 'vscode';
import { warn } from '@textscene/core/logger';

/** The clipboard can refuse a write, such as a remote host with no clipboard: that is logged, not thrown. */
export async function writeClipboard(text: string): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(text);
  } catch (error) {
    warn(`Copy to the clipboard failed: ${String(error)}`);
  }
}

/** The host's one clipboard write: a refused write is logged, not thrown. */

import { describe, expect, it, vi } from 'vitest';
import { warn } from '@textscene/core/logger';
import { vscode } from './test-setup';
import { writeClipboard } from './writeClipboard';

vi.mock('@textscene/core/logger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@textscene/core/logger')>()),
  warn: vi.fn(),
}));

describe('writeClipboard', () => {
  it('writes the text to the clipboard', async () => {
    await writeClipboard('Player/Camera3D');
    expect(vscode.env.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('Player/Camera3D');
  });

  it('logs a refused write and does not throw', async () => {
    vscode.env.clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    await expect(writeClipboard('x')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('denied'));
  });
});

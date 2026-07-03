/**
 * Unit tests for `toResPath` — the inverse of Godot res:// resolution used by
 * dependency hot-reload to turn a changed file's fsPath back into the exact
 * `res://` string the webview registered.
 */
import { describe, expect, it } from 'vitest';
import '../test-setup'; // installs the `vscode` module mock (provider imports vscode)
import { toResPath } from './VSCodeResourceProvider';

describe('toResPath', () => {
  it('maps a file under the project root to a res:// path', () => {
    expect(toResPath('/proj/textures/wood.png', '/proj')).toBe('res://textures/wood.png');
  });

  it('handles a trailing slash on the project root', () => {
    expect(toResPath('/proj/a/b.tres', '/proj/')).toBe('res://a/b.tres');
  });

  it('normalizes Windows-style separators', () => {
    expect(toResPath('C:\\proj\\textures\\wood.png', 'C:\\proj')).toBe('res://textures/wood.png');
  });

  it('is case-insensitive on the root prefix (matches the provider bounds check)', () => {
    expect(toResPath('/Proj/textures/wood.png', '/proj')).toBe('res://textures/wood.png');
  });

  it('returns null when the file is outside the project root', () => {
    expect(toResPath('/other/wood.png', '/proj')).toBeNull();
  });
});

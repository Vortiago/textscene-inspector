import { describe, expect, it } from 'vitest';
import {
  FILE_DIALOG_ACCESS_NAMES,
  FILE_DIALOG_DISPLAY_MODE_NAMES,
  FILE_DIALOG_FILE_MODE_NAMES,
} from './fileDialog.js';

describe('FILE_DIALOG_FILE_MODE_NAMES', () => {
  it('names the five file modes without their FILE_MODE_ prefix (file_dialog.h:119-125)', () => {
    expect(FILE_DIALOG_FILE_MODE_NAMES).toEqual({
      0: 'OPEN_FILE',
      1: 'OPEN_FILES',
      2: 'OPEN_DIR',
      3: 'OPEN_ANY',
      4: 'SAVE_FILE',
    });
  });
});

describe('FILE_DIALOG_DISPLAY_MODE_NAMES', () => {
  it('names the two display modes and leaves out the DISPLAY_MAX count (file_dialog.h:127-131)', () => {
    expect(FILE_DIALOG_DISPLAY_MODE_NAMES).toEqual({ 0: 'THUMBNAILS', 1: 'LIST' });
  });
});

describe('FILE_DIALOG_ACCESS_NAMES', () => {
  it('names the three access scopes without their ACCESS_ prefix (file_dialog.h:113-117)', () => {
    expect(FILE_DIALOG_ACCESS_NAMES).toEqual({ 0: 'RESOURCES', 1: 'USERDATA', 2: 'FILESYSTEM' });
  });
});

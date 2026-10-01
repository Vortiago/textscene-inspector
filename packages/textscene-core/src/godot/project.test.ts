/**
 * Where a Godot 4.6.3 project keeps its GDExtension list, and how the list reads
 * (`project_settings.cpp:879-880`, `gdextension.cpp:45-46`, `gdextension_manager.cpp:319-334`).
 */

import { describe, expect, it } from 'vitest';
import { extensionListEntries, extensionListPath, dataDirectoryPath } from './project.js';

describe('dataDirectoryPath', () => {
  it('is res://.godot by default, and res://godot when the project turns the hidden directory off', () => {
    expect(dataDirectoryPath(true)).toBe('res://.godot');
    expect(dataDirectoryPath(false)).toBe('res://godot');
  });
});

describe('extensionListPath', () => {
  it('is in res://.godot for the default hidden directory', () => {
    expect(extensionListPath(true)).toBe('res://.godot/extension_list.cfg');
  });

  it('is in res://godot when the project turns the hidden directory off', () => {
    expect(extensionListPath(false)).toBe('res://godot/extension_list.cfg');
  });
});

describe('extensionListEntries', () => {
  it('reads one extension path per line', () => {
    expect(extensionListEntries('res://a/a.gdextension\nres://b/b.gdextension\n')).toEqual([
      'res://a/a.gdextension',
      'res://b/b.gdextension',
    ]);
  });

  it('strips control characters and spaces from both ends, a CRLF ending included', () => {
    expect(extensionListEntries('\t res://a/a.gdextension \r\n')).toEqual(['res://a/a.gdextension']);
  });

  it('keeps a non-breaking space, which strip_edges does not strip', () => {
    expect(extensionListEntries(' res://a.gdextension')).toEqual([' res://a.gdextension']);
  });

  it('skips a blank line', () => {
    expect(extensionListEntries('\n  \nres://a/a.gdextension\n\n')).toEqual(['res://a/a.gdextension']);
  });

  it('is empty for an empty file', () => {
    expect(extensionListEntries('')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { GODOT_TEXT_RESOURCE_EXTENSIONS, isGodotTextResourcePath } from './resourceFormats.js';

describe('GODOT_TEXT_RESOURCE_EXTENSIONS', () => {
  it('is exactly the pair the text loader registers', () => {
    expect([...GODOT_TEXT_RESOURCE_EXTENSIONS]).toEqual(['.tscn', '.tres']);
  });
});

describe('isGodotTextResourcePath', () => {
  it('accepts both text formats, bare name or full path', () => {
    expect(isGodotTextResourcePath('level.tscn')).toBe(true);
    expect(isGodotTextResourcePath('theme.tres')).toBe(true);
    expect(isGodotTextResourcePath('/project/scenes/demos/level.tscn')).toBe(true);
  });

  it('rejects every other extension, the binary twins included', () => {
    for (const path of ['level.scn', 'theme.res', 'icon.png', 'player.gd', 'notes.md', '']) {
      expect(isGodotTextResourcePath(path), path).toBe(false);
    }
  });

  it('matches case-insensitively, as `recognize_path` does', () => {
    // resource_loader.cpp:73 compares with `nocasecmp_to`, so `Model.TRES` is a
    // file Godot loads — and one this linter must therefore read.
    expect(isGodotTextResourcePath('Model.TRES')).toBe(true);
    expect(isGodotTextResourcePath('Level.TsCn')).toBe(true);
  });

  it('matches a name that is nothing but the extension', () => {
    // `String::get_extension` has no leading-dot special case, so `.tscn` has
    // extension `tscn` to Godot. Node's `extname('.tscn')` returns `''`, which
    // is how the CLI walk and the editor filter came to disagree.
    expect(isGodotTextResourcePath('.tscn')).toBe(true);
    expect(isGodotTextResourcePath('.tres')).toBe(true);
  });

  it('does not match an extension in the middle of a name', () => {
    expect(isGodotTextResourcePath('level.tscn.bak')).toBe(false);
    expect(isGodotTextResourcePath('tscn')).toBe(false);
  });
});

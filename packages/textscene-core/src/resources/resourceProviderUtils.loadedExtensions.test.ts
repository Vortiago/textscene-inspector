/**
 * `LOADED_FILE_EXTENSIONS` is the VS Code watcher's list, so a file type missing
 * from it never hot-reloads. It derives from the slice claims, which this checks.
 */
import { describe, expect, it } from 'vitest';
import { LOADED_FILE_EXTENSIONS, PROVIDED_FILE_EXTENSIONS } from './resourceProviderUtils';
import { resourceSliceRegistry } from './sliceRegistration';

describe('LOADED_FILE_EXTENSIONS', () => {
  it('holds every extension a registered slice claims', () => {
    const claimed = resourceSliceRegistry.all().flatMap((registration) => registration.extensions ?? []);

    expect(claimed.length).toBeGreaterThan(0);
    expect(LOADED_FILE_EXTENSIONS).toEqual(expect.arrayContaining(claimed));
  });

  it('holds both Godot text resource formats', () => {
    expect(LOADED_FILE_EXTENSIONS).toEqual(expect.arrayContaining(['.tscn', '.tres']));
  });

  it('holds the import sidecar, read beside an asset by convention', () => {
    expect(LOADED_FILE_EXTENSIONS).toContain('.import');
  });

  it('leaves out the project file, which a host watches on its own', () => {
    expect(LOADED_FILE_EXTENSIONS).not.toContain('.godot');
    expect(PROVIDED_FILE_EXTENSIONS).toContain('.godot');
  });

  it('lists each extension once, dotted and lowercase', () => {
    expect(new Set(LOADED_FILE_EXTENSIONS).size).toBe(LOADED_FILE_EXTENSIONS.length);
    for (const extension of LOADED_FILE_EXTENSIONS) expect(extension).toMatch(/^\.[a-z0-9]+$/);
  });
});

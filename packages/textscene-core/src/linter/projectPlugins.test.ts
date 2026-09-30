/**
 * Whether a project can add a GLTFDocumentExtension: an editor plugin it enables (`editor_node.cpp:1167-1173`) or a
 * GDExtension it lists (`gdextension_manager.cpp:319-334`), read through the linter's provider.
 */

import { describe, expect, it } from 'vitest';
import { projectMayExtendGltfImport } from './projectPlugins.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';

function project(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

const PLUGIN_ENABLED = '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/a/plugin.cfg")\n';

describe('projectMayExtendGltfImport', () => {
  it('is true for a project that enables an editor plugin', async () => {
    expect(await projectMayExtendGltfImport(project({ 'res://project.godot': PLUGIN_ENABLED }))).toBe(true);
  });

  it('is true for a project that lists a GDExtension', async () => {
    const files = { 'res://.godot/extension_list.cfg': 'res://bin/a.gdextension\n' };
    expect(await projectMayExtendGltfImport(project(files))).toBe(true);
  });

  it('reads a project file a provider hands back as bytes', async () => {
    const bytes = new TextEncoder().encode(PLUGIN_ENABLED).buffer;
    expect(await projectMayExtendGltfImport(project({ 'res://project.godot': bytes }))).toBe(true);
  });

  it('is false for a project that enables no plugin and lists no GDExtension', async () => {
    const files = {
      'res://project.godot': '[editor_plugins]\nenabled=PackedStringArray()\n',
      'res://.godot/extension_list.cfg': '\n',
    };
    expect(await projectMayExtendGltfImport(project(files))).toBe(false);
  });

  it('is false when neither file exists or can be read', async () => {
    expect(await projectMayExtendGltfImport(project({}))).toBe(false);
    expect(await projectMayExtendGltfImport({ loadResource: () => Promise.reject(new Error('denied')) })).toBe(false);
  });

  it('reads the GDExtension list from the data directory the project names', async () => {
    const files = {
      'res://project.godot': '[application]\nconfig/use_hidden_project_data_directory=false\n',
      'res://.godot/extension_list.cfg': 'res://bin/a.gdextension\n',
    };
    expect(await projectMayExtendGltfImport(project(files))).toBe(false);
  });
});

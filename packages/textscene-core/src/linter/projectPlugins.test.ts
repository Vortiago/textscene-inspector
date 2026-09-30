/**
 * Whether a project can add a GLTFDocumentExtension: an editor plugin it enables (`editor_node.cpp:1167-1173`) or a
 * GDExtension it lists (`gdextension_manager.cpp:319-334`), read through the linter's provider and kept by stamp.
 */

import { describe, expect, it } from 'vitest';
import { PLUGIN_PROBE_PATHS, ProjectPluginProbes } from './projectPlugins.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';

function project(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

function mayExtend(provider: ResourceProvider): Promise<boolean> {
  return new ProjectPluginProbes().mayExtendGltfImport(provider);
}

const PLUGIN_ENABLED = '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/a/plugin.cfg")\n';

describe('ProjectPluginProbes.mayExtendGltfImport', () => {
  it('is true for a project that enables an editor plugin', async () => {
    expect(await mayExtend(project({ 'res://project.godot': PLUGIN_ENABLED }))).toBe(true);
  });

  it('is true for a project that lists a GDExtension', async () => {
    const files = { 'res://.godot/extension_list.cfg': 'res://bin/a.gdextension\n' };
    expect(await mayExtend(project(files))).toBe(true);
  });

  it('reads a project file a provider hands back as bytes', async () => {
    const bytes = new TextEncoder().encode(PLUGIN_ENABLED).buffer;
    expect(await mayExtend(project({ 'res://project.godot': bytes }))).toBe(true);
  });

  it('is false for a project that enables no plugin and lists no GDExtension', async () => {
    const files = {
      'res://project.godot': '[editor_plugins]\nenabled=PackedStringArray()\n',
      'res://.godot/extension_list.cfg': '\n  \n',
    };
    expect(await mayExtend(project(files))).toBe(false);
  });

  it('is false when neither file exists or can be read', async () => {
    expect(await mayExtend(project({}))).toBe(false);
    expect(await mayExtend({ loadResource: () => Promise.reject(new Error('denied')) })).toBe(false);
  });

  it('reads the GDExtension list from the data directory the project names', async () => {
    const files: Record<string, string> = {
      'res://project.godot': '[application]\nconfig/use_hidden_project_data_directory=false\n',
      'res://.godot/extension_list.cfg': 'res://bin/a.gdextension\n',
    };
    expect(await mayExtend(project(files))).toBe(false);
    files['res://godot/extension_list.cfg'] = 'res://bin/a.gdextension\n';
    expect(await mayExtend(project(files))).toBe(true);
  });
});

describe('the kept plugin answer', () => {
  /** A project whose files carry the stamps in `stamps`, and a log of each file it reads. */
  function stamped(files: Record<string, string>, stamps: Record<string, string>) {
    const reads: string[] = [];
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        reads.push(path);
        return files[path] ?? null;
      },
      stamp: async (path) => stamps[path] ?? null,
    };
    return { provider, reads };
  }

  it('does not read an unchanged project file again', async () => {
    const { provider, reads } = stamped({ 'res://project.godot': PLUGIN_ENABLED }, { 'res://project.godot': '1' });
    const probes = new ProjectPluginProbes();

    expect(await probes.mayExtendGltfImport(provider)).toBe(true);
    expect(await probes.mayExtendGltfImport(provider)).toBe(true);

    expect(reads).toEqual(['res://project.godot']);
  });

  it('reads the project file again once its stamp changes', async () => {
    const files = { 'res://project.godot': PLUGIN_ENABLED };
    const stamps = { 'res://project.godot': '1' };
    const { provider, reads } = stamped(files, stamps);
    const probes = new ProjectPluginProbes();
    await probes.mayExtendGltfImport(provider);

    files['res://project.godot'] = 'config_version=5\n';
    stamps['res://project.godot'] = '2';

    expect(await probes.mayExtendGltfImport(provider)).toBe(false);
    expect(reads.filter((path) => path === 'res://project.godot')).toHaveLength(2);
  });

  it('keeps the extension list by its own stamp', async () => {
    const files = { 'res://project.godot': 'config_version=5\n', 'res://.godot/extension_list.cfg': '\n' };
    const stamps = { 'res://project.godot': '1', 'res://.godot/extension_list.cfg': 'a' };
    const { provider, reads } = stamped(files, stamps);
    const probes = new ProjectPluginProbes();
    expect(await probes.mayExtendGltfImport(provider)).toBe(false);
    expect(await probes.mayExtendGltfImport(provider)).toBe(false);
    expect(reads).toEqual(['res://project.godot', 'res://.godot/extension_list.cfg']);

    files['res://.godot/extension_list.cfg'] = 'res://bin/a.gdextension\n';
    stamps['res://.godot/extension_list.cfg'] = 'b';

    expect(await probes.mayExtendGltfImport(provider)).toBe(true);
    expect(reads).toEqual(['res://project.godot', 'res://.godot/extension_list.cfg', 'res://.godot/extension_list.cfg']);
  });

  it('stamps the kept extension list beside the project file, not after it', async () => {
    const files = { 'res://project.godot': 'config_version=5\n', 'res://.godot/extension_list.cfg': '\n' };
    const { provider } = stamped(files, { 'res://project.godot': '1', 'res://.godot/extension_list.cfg': 'a' });
    const probes = new ProjectPluginProbes();
    await probes.mayExtendGltfImport(provider);

    const asked: string[] = [];
    let releaseProject: (stamp: string) => void = () => {};
    provider.stamp = (path) => {
      asked.push(path);
      return path === 'res://project.godot' ? new Promise((resolve) => (releaseProject = resolve)) : Promise.resolve('a');
    };
    const answer = probes.mayExtendGltfImport(provider);

    expect(asked).toEqual(['res://.godot/extension_list.cfg', 'res://project.godot']);
    releaseProject('1');
    expect(await answer).toBe(false);
  });

  it('reads a file with no stamp every time', async () => {
    const { provider, reads } = stamped({ 'res://project.godot': PLUGIN_ENABLED }, {});
    const probes = new ProjectPluginProbes();

    await probes.mayExtendGltfImport(provider);
    await probes.mayExtendGltfImport(provider);

    expect(reads).toEqual(['res://project.godot', 'res://project.godot']);
  });
});

describe('PLUGIN_PROBE_PATHS', () => {
  it('names the project file and the extension list under both data directories', () => {
    expect([...PLUGIN_PROBE_PATHS].sort()).toEqual([
      'res://.godot/extension_list.cfg',
      'res://godot/extension_list.cfg',
      'res://project.godot',
    ]);
  });
});

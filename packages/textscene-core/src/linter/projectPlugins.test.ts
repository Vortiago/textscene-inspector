/**
 * Whether code in a project can add a GLTFDocumentExtension: an editor plugin it enables (`editor_node.cpp:1167-1173`),
 * an autoload it declares (`editor_autoload_settings.cpp:428-455`), or a GDExtension the editor's scan finds
 * (`editor_file_system.cpp:310-334`). Only a readable project file and a listing that finds no GDExtension rule one out.
 */

import { describe, expect, it, vi } from 'vitest';
import { PLUGIN_PROBE_PATHS, ProjectPluginProbes } from './projectPlugins.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { PLAIN_PROJECT_FILE, memoryProject, unlistableProject } from './testing/memoryProject.js';

function mayExtend(provider: ResourceProvider): Promise<boolean> {
  return new ProjectPluginProbes().probe(provider)();
}

const PLUGIN_ENABLED = '[editor_plugins]\n\nenabled=PackedStringArray("res://addons/a/plugin.cfg")\n';
const AUTOLOAD_DECLARED = 'config_version=5\n\n[autoload]\n\nImporter="*res://importer.gd"\n';

describe('ProjectPluginProbes.probe', () => {
  it('is true for a project that enables an editor plugin', async () => {
    expect(await mayExtend(memoryProject({ 'res://project.godot': PLUGIN_ENABLED }))).toBe(true);
  });

  it('is true for a project that declares an autoload, which a tool script can make register one', async () => {
    expect(await mayExtend(memoryProject({ 'res://project.godot': AUTOLOAD_DECLARED }))).toBe(true);
  });

  it('is true for a project that holds a .gdextension file anywhere, with no .godot directory', async () => {
    const files = {
      'res://project.godot': PLAIN_PROJECT_FILE,
      'res://addons/gltf/bin/Importer.GDExtension': '',
    };
    expect(await mayExtend(memoryProject(files))).toBe(true);
  });

  it('is true for a project whose extension list names a GDExtension the listing does not find', async () => {
    const files = {
      'res://project.godot': PLAIN_PROJECT_FILE,
      'res://.godot/extension_list.cfg': 'res://a.gdextension\n',
    };
    expect(await mayExtend(memoryProject(files))).toBe(true);
  });

  it('reads a project file a provider hands back as bytes', async () => {
    const bytes = new TextEncoder().encode(PLUGIN_ENABLED).buffer;
    expect(await mayExtend(memoryProject({ 'res://project.godot': bytes }))).toBe(true);
  });

  it('is false for a readable project with no plugin, no autoload and no GDExtension the listing finds', async () => {
    const files = {
      'res://project.godot': '[editor_plugins]\nenabled=PackedStringArray()\n',
      'res://.godot/extension_list.cfg': '\n  \n',
      'res://tree.glb': '',
    };
    expect(await mayExtend(memoryProject(files))).toBe(false);
  });

  it('is true when the project file is missing or unreadable, since nothing is then proven', async () => {
    expect(await mayExtend(memoryProject({}))).toBe(true);
    const denied: ResourceProvider = {
      loadResource: () => Promise.reject(new Error('denied')),
      listFiles: async () => [],
    };
    expect(await mayExtend(denied)).toBe(true);
  });

  it('is true for a provider that cannot list, or whose listing gives null or rejects', async () => {
    const files = { 'res://project.godot': PLAIN_PROJECT_FILE };
    expect(await mayExtend(unlistableProject(files))).toBe(true);
    expect(await mayExtend({ ...unlistableProject(files), listFiles: async () => null })).toBe(true);
    const rejecting = { ...unlistableProject(files), listFiles: () => Promise.reject(new Error('denied')) };
    expect(await mayExtend(rejecting)).toBe(true);
  });

  it('leaves out a .gdextension inside the data directory the project names, which the scan skips', async () => {
    const files: Record<string, string> = {
      'res://project.godot': '[application]\nconfig/use_hidden_project_data_directory=false\n',
      'res://godot/cache/a.gdextension': '',
    };
    expect(await mayExtend(memoryProject(files))).toBe(false);
    files['res://godot.gdextension'] = '';
    expect(await mayExtend(memoryProject(files))).toBe(true);
  });

  it('reads the GDExtension list from the data directory the project names', async () => {
    const files: Record<string, string> = {
      'res://project.godot': '[application]\nconfig/use_hidden_project_data_directory=false\n',
      'res://.godot/extension_list.cfg': 'res://bin/a.gdextension\n',
    };
    expect(await mayExtend(memoryProject(files))).toBe(false);
    files['res://godot/extension_list.cfg'] = 'res://bin/a.gdextension\n';
    expect(await mayExtend(memoryProject(files))).toBe(true);
  });

  it('reads the project files at once, and lists the project only when the answer is asked for', async () => {
    const provider = memoryProject({ 'res://project.godot': PLAIN_PROJECT_FILE });
    const load = vi.spyOn(provider, 'loadResource');
    const list = vi.spyOn(provider, 'listFiles' as never) as unknown as ReturnType<typeof vi.fn>;

    const answer = new ProjectPluginProbes().probe(provider);

    expect(load.mock.calls.map(([path]) => path)).toEqual(['res://project.godot']);
    expect(list).not.toHaveBeenCalled();
    expect(await answer()).toBe(false);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('lists nothing when the project file already settles the answer', async () => {
    const provider = memoryProject({ 'res://project.godot': PLUGIN_ENABLED });
    const list = vi.spyOn(provider, 'listFiles' as never) as unknown as ReturnType<typeof vi.fn>;

    expect(await new ProjectPluginProbes().probe(provider)()).toBe(true);
    expect(list).not.toHaveBeenCalled();
  });
});

describe('the kept plugin answer', () => {
  /** A project whose files carry the stamps in `stamps` and that holds no GDExtension, and a log of each file it reads. */
  function stamped(files: Record<string, string>, stamps: Record<string, string>) {
    const reads: string[] = [];
    const provider: ResourceProvider = {
      loadResource: async (path) => {
        reads.push(path);
        return files[path] ?? null;
      },
      stamp: async (path) => stamps[path] ?? null,
      listFiles: async () => [],
    };
    return { provider, reads };
  }

  it('does not read an unchanged project file again', async () => {
    const { provider, reads } = stamped(
      { 'res://project.godot': PLUGIN_ENABLED },
      { 'res://project.godot': '1' }
    );
    const probes = new ProjectPluginProbes();

    expect(await probes.probe(provider)()).toBe(true);
    expect(await probes.probe(provider)()).toBe(true);

    expect(reads).toEqual(['res://project.godot']);
  });

  it('reads the project file again once its stamp changes', async () => {
    const files = { 'res://project.godot': PLUGIN_ENABLED };
    const stamps = { 'res://project.godot': '1' };
    const { provider, reads } = stamped(files, stamps);
    const probes = new ProjectPluginProbes();
    await probes.probe(provider)();

    files['res://project.godot'] = 'config_version=5\n';
    stamps['res://project.godot'] = '2';

    expect(await probes.probe(provider)()).toBe(false);
    expect(reads.filter((path) => path === 'res://project.godot')).toHaveLength(2);
  });

  it('keeps the extension list by its own stamp', async () => {
    const files = { 'res://project.godot': 'config_version=5\n', 'res://.godot/extension_list.cfg': '\n' };
    const stamps = { 'res://project.godot': '1', 'res://.godot/extension_list.cfg': 'a' };
    const { provider, reads } = stamped(files, stamps);
    const probes = new ProjectPluginProbes();
    expect(await probes.probe(provider)()).toBe(false);
    expect(await probes.probe(provider)()).toBe(false);
    expect(reads).toEqual(['res://project.godot', 'res://.godot/extension_list.cfg']);

    files['res://.godot/extension_list.cfg'] = 'res://bin/a.gdextension\n';
    stamps['res://.godot/extension_list.cfg'] = 'b';

    expect(await probes.probe(provider)()).toBe(true);
    expect(reads).toEqual([
      'res://project.godot',
      'res://.godot/extension_list.cfg',
      'res://.godot/extension_list.cfg',
    ]);
  });

  it('stamps the kept extension list beside the project file, not after it', async () => {
    const files = { 'res://project.godot': 'config_version=5\n', 'res://.godot/extension_list.cfg': '\n' };
    const { provider } = stamped(files, {
      'res://project.godot': '1',
      'res://.godot/extension_list.cfg': 'a',
    });
    const probes = new ProjectPluginProbes();
    await probes.probe(provider)();

    const asked: string[] = [];
    let releaseProject: (stamp: string) => void = () => {};
    provider.stamp = (path) => {
      asked.push(path);
      return path === 'res://project.godot'
        ? new Promise((resolve) => (releaseProject = resolve))
        : Promise.resolve('a');
    };
    const answer = probes.probe(provider)();

    expect(asked).toEqual(['res://.godot/extension_list.cfg', 'res://project.godot']);
    releaseProject('1');
    expect(await answer).toBe(false);
  });

  it('reads a file with no stamp every time', async () => {
    const { provider, reads } = stamped({ 'res://project.godot': PLUGIN_ENABLED }, {});
    const probes = new ProjectPluginProbes();

    await probes.probe(provider)();
    await probes.probe(provider)();

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

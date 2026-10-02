/**
 * The **Project settings** seam: a missing `res://project.godot` is an ordinary
 * outcome, as in Godot's `ThemeDB::initialize_theme_noproject()`, and never
 * reaches the Missing Resources panel.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../../resources/FileEventBus';
import { ResourceLoader } from '../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { PROJECT_FILE_PATH } from '../../godot/project.js';
import { ProjectSettingsProvider, useProjectSettings } from './ProjectSettingsContext';

function Probe() {
  const { themeScale, settings } = useProjectSettings();
  return (
    <>
      <span data-testid="scale">{themeScale}</span>
      <span data-testid="name">{settings?.['application/config/name'] ?? 'none'}</span>
    </>
  );
}

/** A provider that serves only the paths in `files`. Anything else is a miss. */
function fakeProvider(files: Record<string, string>): ResourceProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async loadResource(path: string) {
      calls.push(path);
      const content = files[path];
      if (content === undefined) throw new Error(`Resource not found: ${path}`);
      return content;
    },
  };
}

function mountWith(provider: ResourceProvider, sceneKey = 'res://scene.tscn') {
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return render(
    <ResourceLoaderProvider loader={loader}>
      <ProjectSettingsProvider sceneKey={sceneKey}>
        <Probe />
      </ProjectSettingsProvider>
    </ResourceLoaderProvider>
  );
}

const DEMO_PROJECT = `config_version=5

[application]

config/name="GUI in 3D"

[gui]

theme/default_theme_scale=2.0
`;

describe('ProjectSettingsProvider', () => {
  it('reads gui/theme/default_theme_scale from res://project.godot', async () => {
    mountWith(fakeProvider({ [PROJECT_FILE_PATH]: DEMO_PROJECT }));
    await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));
    expect(screen.getByTestId('name').textContent).toBe('GUI in 3D');
  });

  it('stays at 1.0 when the project has no such key', async () => {
    mountWith(fakeProvider({ [PROJECT_FILE_PATH]: '[application]\n\nconfig/name="Plain"\n' }));
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Plain'));
    expect(screen.getByTestId('scale').textContent).toBe('1');
  });

  it('treats an absent project.godot as ordinary, at Godot’s defaults', async () => {
    // Most fixtures are loose scenes with no project around them.
    const provider = fakeProvider({});
    mountWith(provider);
    await waitFor(() => expect(provider.calls).toContain(PROJECT_FILE_PATH));
    expect(screen.getByTestId('scale').textContent).toBe('1');
    expect(screen.getByTestId('name').textContent).toBe('none');
  });

  it('never routes the lookup through the failure path that feeds Missing Resources', async () => {
    const provider = fakeProvider({});
    const bus = new FileEventBus(provider);
    const failed = vi.fn();
    bus.on('failed', failed);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    render(
      <ResourceLoaderProvider loader={loader}>
        <ProjectSettingsProvider sceneKey="res://scene.tscn">
          <Probe />
        </ProjectSettingsProvider>
      </ResourceLoaderProvider>
    );

    await waitFor(() => expect(provider.calls).toContain(PROJECT_FILE_PATH));
    expect(failed).not.toHaveBeenCalled();
  });

  it('falls back to Godot’s defaults when the file is not a project.godot', async () => {
    mountWith(fakeProvider({ [PROJECT_FILE_PATH]: 'not an ini file at all' }));
    await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('1'));
  });

  it('re-reads on a scene swap, since res://project.godot is the same path in every corpus', async () => {
    const provider = fakeProvider({ [PROJECT_FILE_PATH]: DEMO_PROJECT });
    const bus = new FileEventBus(provider);
    const loader = new ResourceLoader(bus);
    loader.setProvider(provider);

    const tree = (sceneKey: string) => (
      <ResourceLoaderProvider loader={loader}>
        <ProjectSettingsProvider sceneKey={sceneKey}>
          <Probe />
        </ProjectSettingsProvider>
      </ResourceLoaderProvider>
    );

    const { rerender } = render(tree('res://a.tscn'));
    await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));

    // A corpus switch drops the byte layer first, so the re-read cannot serve
    // the outgoing project's file.
    loader.clearCaches();
    rerender(tree('res://b.tscn'));
    await waitFor(() => expect(provider.calls.filter((p) => p === PROJECT_FILE_PATH).length).toBe(2));
  });

  describe('when res://project.godot changes on disk', () => {
    function mountChanging(files: Record<string, string>) {
      const provider = fakeProvider(files);
      const bus = new FileEventBus(provider);
      const loader = new ResourceLoader(bus);
      loader.setProvider(provider);
      const seenScales: string[] = [];
      function ScaleLog() {
        seenScales.push(String(useProjectSettings().themeScale));
        return null;
      }
      render(
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">
            <Probe />
            <ScaleLog />
          </ProjectSettingsProvider>
        </ResourceLoaderProvider>
      );
      return { provider, bus, seenScales };
    }

    it('reads the file again and shows the new settings', async () => {
      const files = { [PROJECT_FILE_PATH]: DEMO_PROJECT };
      const { bus } = mountChanging(files);
      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));

      files[PROJECT_FILE_PATH] = DEMO_PROJECT.replace('2.0', '3.0');
      bus.invalidate(PROJECT_FILE_PATH);

      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('3'));
    });

    it('keeps the old settings until the new ones arrive, never flashing the default', async () => {
      const files = { [PROJECT_FILE_PATH]: DEMO_PROJECT };
      const { bus, seenScales } = mountChanging(files);
      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));
      const firstLoaded = seenScales.indexOf('2');

      files[PROJECT_FILE_PATH] = DEMO_PROJECT.replace('2.0', '3.0');
      bus.invalidate(PROJECT_FILE_PATH);
      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('3'));

      expect(seenScales.slice(firstLoaded)).not.toContain('1');
    });

    it('falls back to Godot’s defaults when the file is removed', async () => {
      const files: Record<string, string> = { [PROJECT_FILE_PATH]: DEMO_PROJECT };
      const { bus } = mountChanging(files);
      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));

      delete files[PROJECT_FILE_PATH];
      bus.invalidate(PROJECT_FILE_PATH);

      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('1'));
      expect(screen.getByTestId('name').textContent).toBe('none');
    });

    it('ignores a change to any other file', async () => {
      const { provider, bus } = mountChanging({ [PROJECT_FILE_PATH]: DEMO_PROJECT });
      await waitFor(() => expect(screen.getByTestId('scale').textContent).toBe('2'));

      bus.invalidate('res://icon.png');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(provider.calls.filter((p) => p === PROJECT_FILE_PATH)).toHaveLength(1);
    });
  });

  it('is safe without a provider: no settings, scale 1.0', () => {
    render(<Probe />);
    expect(screen.getByTestId('scale').textContent).toBe('1');
    expect(screen.getByTestId('name').textContent).toBe('none');
  });
});

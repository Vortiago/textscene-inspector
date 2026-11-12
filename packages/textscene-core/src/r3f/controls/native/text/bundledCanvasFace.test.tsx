/**
 * The bundled canvas face waits for the project settings: the default font takes its hinting from
 * `gui/theme/default_font_hinting` once (`theme_db.cpp:56`), so no outline loads at another hinting.
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hinting } from '../../../../godot/text/textServerEnums';
import { PROJECT_FILE_PATH } from '../../../../godot/project/project';
import { FileEventBus } from '../../../../resources/FileEventBus';
import { ResourceLoader } from '../../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import type { ResourceProvider } from '../../../../resources/ResourceProvider';
import { ProjectSettingsProvider } from '../../../contexts/ProjectSettingsContext';
import { TRIANGLE_OUTLINES } from '../testing/triangleOutlines';
import { useBundledCanvasFace } from './bundledCanvasFace';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { peekOutlines } from './sceneFontOutlines';

vi.mock('./sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: vi.fn(() => TRIANGLE_OUTLINES),
}));

const UNHINTED_PROJECT = '[gui]\n\ntheme/default_font_hinting=0\n';

function PeekProbe() {
  useBundledCanvasFace()(OPEN_SANS_FONT_METRICS);
  return null;
}

/** Mounts a peek of the bundled canvas face in a project whose only file is `projectFile`. */
function mountPeekIn(projectFile: string) {
  const provider: ResourceProvider = {
    loadResource: async (path) => {
      if (path !== PROJECT_FILE_PATH) throw new Error(`expected ${PROJECT_FILE_PATH}, got ${path}`);
      return projectFile;
    },
  };
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return render(
    <ResourceLoaderProvider loader={loader}>
      <ProjectSettingsProvider sceneKey="res://scene.tscn">
        <PeekProbe />
      </ProjectSettingsProvider>
    </ResourceLoaderProvider>
  );
}

const requestedHintings = () => new Set(vi.mocked(peekOutlines).mock.calls.map(([, load]) => load.hinting));

describe('useBundledCanvasFace', () => {
  afterEach(() => vi.mocked(peekOutlines).mockClear());

  it('asks for outlines at the hinting of the project alone', async () => {
    mountPeekIn(UNHINTED_PROJECT);

    await waitFor(() => expect(requestedHintings()).toContain(Hinting.NONE));
    expect(requestedHintings()).toEqual(new Set([Hinting.NONE]));
  });

  it('asks for outlines at the default hinting with no provider around it', () => {
    render(<PeekProbe />);

    expect(requestedHintings()).toEqual(new Set([Hinting.LIGHT]));
  });
});

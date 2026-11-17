import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFallbackEnvironment } from './fallbackEnvironment';
import type { EnvironmentResolution } from './WorldEnvironmentScope';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { ViewportDescriptionProvider } from '../viewportRender/viewportDescriptionContext';
import { gameViewportDescription, type ViewportDescription } from '../viewportRender/viewportDescription';
import type { ParsedResource } from '../../parser/parsedResource';

const DEFAULT_ENV_PATH = 'res://default_env.tres';

const DEFAULT_ENV: ParsedResource = {
  resourceType: 'Environment',
  properties: { background_mode: '1', background_color: 'Color(0.2, 0.3, 0.4, 1)' },
  extResources: [],
  subResources: [],
};

/** The hook's resolution in a viewport whose fallback is `path`. A file seeded `null` failed. */
async function fallbackIn(
  path: string | null,
  file?: ParsedResource | null,
  facts: Partial<ViewportDescription> = {}
): Promise<EnvironmentResolution> {
  const fake = createFakeResourceLoader();
  if (file !== undefined) fake.resources.seed(DEFAULT_ENV_PATH, file);
  let seen: EnvironmentResolution | null = null;
  function Probe() {
    seen = useFallbackEnvironment(path);
    return null;
  }
  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <ViewportDescriptionProvider
        description={{ ...gameViewportDescription(null), fallbackEnvironment: path, ...facts }}
      >
        <Probe />
      </ViewportDescriptionProvider>
    </ResourceLoaderProvider>
  );
  const renderer = await ReactThreeTestRenderer.create(tree);
  // A second pass so the file served from the seeded cache is reflected.
  await renderer.update(tree);
  return seen!;
}

describe('useFallbackEnvironment', () => {
  it('resolves the Environment file the viewport falls back to', async () => {
    const resolution = await fallbackIn(DEFAULT_ENV_PATH, DEFAULT_ENV);
    expect(resolution.status).toBe('resolved');
  });

  it('lights a viewport with no fallback by the clear colour at energy 1', async () => {
    expect(ambientOf(await fallbackIn(null))).toEqual({ color: GODOT_CLEAR_COLOR, energy: 1 });
  });

  it('draws the clear colour of a viewport with no fallback at no exposure', async () => {
    const resolution = await fallbackIn(null);
    expect(
      resolution.status === 'resolved' && resolution.environment.settings.background.ignoresExposure
    ).toBe(true);
  });

  it('lights by the clear colour when the fallback file fails to load (error case)', async () => {
    expect(ambientOf(await fallbackIn(DEFAULT_ENV_PATH, null))).toEqual({
      color: GODOT_CLEAR_COLOR,
      energy: 1,
    });
  });

  it('resolves to none for a transparent viewport, whose clear colour is black (edge case)', async () => {
    expect((await fallbackIn(null, undefined, { transparentBackground: true })).status).toBe('none');
  });

  it('resolves to none for a viewport that never clears, whose clear colour stays black (edge case)', async () => {
    expect((await fallbackIn(null, undefined, { requestsClear: false })).status).toBe('none');
  });
});

/** `default_clear_color`'s default (`renderer_viewport.cpp:751`). */
const GODOT_CLEAR_COLOR = { r: 0.3, g: 0.3, b: 0.3, a: 1 };

function ambientOf(resolution: EnvironmentResolution): { color: unknown; energy: number } | null {
  if (resolution.status !== 'resolved') return null;
  const ambient = resolution.environment.settings.ambient;
  return ambient ? { color: ambient.color, energy: ambient.energy } : null;
}

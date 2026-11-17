/**
 * The root's world falls back to the Environment the project's `default_environment` names, a
 * `res://` file no scene holds.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useFallbackEnvironment } from './fallbackEnvironment';
import type { EnvironmentResolution } from './WorldEnvironmentScope';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { ViewportDescriptionProvider } from '../viewportRender/viewportDescriptionContext';
import { gameViewportDescription } from '../viewportRender/viewportDescription';
import type { ParsedResource } from '../../parser/parsedResource';

const DEFAULT_ENV_PATH = 'res://default_env.tres';

const DEFAULT_ENV: ParsedResource = {
  resourceType: 'Environment',
  properties: { background_mode: '1', background_color: 'Color(0.2, 0.3, 0.4, 1)' },
  extResources: [],
  subResources: [],
};

/** The hook's resolution in a viewport whose fallback is `path`. A file seeded `null` failed. */
async function fallbackIn(path: string | null, file?: ParsedResource | null): Promise<EnvironmentResolution> {
  const fake = createFakeResourceLoader();
  if (file !== undefined) fake.resources.seed(DEFAULT_ENV_PATH, file);
  let seen: EnvironmentResolution | null = null;
  function Probe() {
    seen = useFallbackEnvironment();
    return null;
  }
  const tree = (
    <ResourceLoaderProvider loader={fake.loader}>
      <ViewportDescriptionProvider
        description={{ ...gameViewportDescription(null), fallbackEnvironment: path }}
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

  it('resolves to none for a viewport with no fallback', async () => {
    expect((await fallbackIn(null)).status).toBe('none');
  });

  it('resolves to none for a fallback file that fails to load (error case)', async () => {
    expect((await fallbackIn(DEFAULT_ENV_PATH, null)).status).toBe('none');
  });
});

/**
 * Each world draws with the first WorldEnvironment that holds a valid Environment, and the root falls
 * back to the editor preview or to none. Markers stand in for the layers, whose passes need a real
 * GL context.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { NO_RESOURCES } from '../SceneResourcesContext';
import type { EnvironmentLayerProps } from './EnvironmentLayer';
import {
  RootEnvironmentScope,
  ViewportEnvironmentScope,
  usePublishEnvironment,
  type EnvironmentResolution,
} from './WorldEnvironmentScope';

vi.mock('./EnvironmentLayer', () => ({
  EnvironmentLayer: ({ settings }: EnvironmentLayerProps) => (
    <group name="EnvironmentLayer" userData={{ settings }} />
  ),
}));
vi.mock('./NoEnvironmentLayer', () => ({
  NoEnvironmentLayer: () => <group name="NoEnvironmentLayer" />,
}));
vi.mock('../preview/PreviewEnvironment', () => ({
  PreviewEnvironment: () => <group name="PreviewEnvironment" />,
}));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const LAYERS = ['EnvironmentLayer', 'NoEnvironmentLayer', 'PreviewEnvironment'];

function mountedLayers(renderer: Renderer): string[] {
  return renderer.scene
    .findAll((node) => LAYERS.includes(node.props.name as string))
    .map((node) => node.props.name as string);
}

function resolved(name: string): EnvironmentResolution {
  const settings = { name } as unknown as EnvironmentLayerProps['settings'];
  return {
    status: 'resolved',
    environment: { settings, sky: null, resources: NO_RESOURCES, skyResources: NO_RESOURCES },
  };
}

const PENDING: EnvironmentResolution = { status: 'pending' };
const NONE: EnvironmentResolution = { status: 'none' };

function Publisher({ resolution }: { resolution: EnvironmentResolution }) {
  usePublishEnvironment(resolution);
  return null;
}

function inRoot(children: ReactNode, showPreviewEnvironment = true) {
  return (
    <ViewportModeProvider initialShowPreviewEnvironment={showPreviewEnvironment}>
      <RootEnvironmentScope>{children}</RootEnvironmentScope>
    </ViewportModeProvider>
  );
}

describe('<RootEnvironmentScope>', () => {
  it('draws the preview environment for a world with no WorldEnvironment', async () => {
    expect(mountedLayers(await ReactThreeTestRenderer.create(inRoot(null)))).toEqual(['PreviewEnvironment']);
  });

  it('draws with no Environment when the user turns the preview off', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(null, false));
    expect(mountedLayers(renderer)).toEqual(['NoEnvironmentLayer']);
  });

  it('draws a resolved Environment', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={resolved('a')} />));
    expect(mountedLayers(renderer)).toEqual(['EnvironmentLayer']);
  });

  it('draws with no Environment for a WorldEnvironment whose Environment is missing', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={NONE} />));
    expect(mountedLayers(renderer)).toEqual(['NoEnvironmentLayer']);
  });

  it('draws nothing while the Environment loads', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={PENDING} />));
    expect(mountedLayers(renderer)).toEqual([]);
  });

  it('passes over a WorldEnvironment with no valid Environment to the next one', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <Publisher resolution={NONE} />
          <Publisher resolution={resolved('second')} />
        </>
      )
    );
    const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
    expect(layer.props.userData.settings).toEqual({ name: 'second' });
  });

  it('keeps the first valid WorldEnvironment when two resolve', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <Publisher resolution={resolved('first')} />
          <Publisher resolution={resolved('second')} />
        </>
      )
    );
    const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
    expect(layer.props.userData.settings).toEqual({ name: 'first' });
  });

  it('keeps the first WorldEnvironment first when its Environment changes', async () => {
    const tree = (first: EnvironmentResolution) =>
      inRoot(
        <>
          <Publisher resolution={first} />
          <Publisher resolution={resolved('second')} />
        </>
      );
    const renderer = await ReactThreeTestRenderer.create(tree(PENDING));
    await renderer.update(tree(resolved('first')));
    const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
    expect(layer.props.userData.settings).toEqual({ name: 'first' });
  });

  it('returns to the preview when the WorldEnvironment leaves', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={resolved('a')} />));
    await renderer.update(inRoot(null));
    expect(mountedLayers(renderer)).toEqual(['PreviewEnvironment']);
  });
});

describe('<ViewportEnvironmentScope>', () => {
  it('draws a resolved Environment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportEnvironmentScope>
        <Publisher resolution={resolved('a')} />
      </ViewportEnvironmentScope>
    );
    expect(mountedLayers(renderer)).toEqual(['EnvironmentLayer']);
  });

  it('adds no layer for a missing Environment, so the pass keeps its own clear colour', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportEnvironmentScope>
        <Publisher resolution={NONE} />
      </ViewportEnvironmentScope>
    );
    expect(mountedLayers(renderer)).toEqual([]);
  });

  it('keeps its WorldEnvironment out of the root world', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <ViewportEnvironmentScope>
          <Publisher resolution={resolved('a')} />
        </ViewportEnvironmentScope>
      )
    );
    expect(mountedLayers(renderer).sort()).toEqual(['EnvironmentLayer', 'PreviewEnvironment']);
  });
});

describe('usePublishEnvironment', () => {
  it('refuses a WorldEnvironment outside any world', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ReactThreeTestRenderer.create(<Publisher resolution={NONE} />)).rejects.toThrow(
      /expected a world environment scope/
    );
  });
});

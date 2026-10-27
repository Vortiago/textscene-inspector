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
import { TreeOrderProvider, type TreeOrder } from '../contexts/TreeOrderContext';
import type { EnvironmentLayerProps } from './EnvironmentLayer';
import {
  WorldEnvironmentScope,
  usePublishEnvironment,
  type EnvironmentResolution,
} from './WorldEnvironmentScope';
import { NO_RESOLUTION, PENDING_RESOLUTION } from './worldGroup';

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
vi.mock('../preview/PreviewSun', () => ({
  PreviewSun: () => <group name="PreviewSun" />,
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

function Publisher({ resolution }: { resolution: EnvironmentResolution }) {
  usePublishEnvironment(resolution);
  return null;
}

/** Publishes as a WorldEnvironment does: from the node itself, whose children mount first. */
function PublishingNode({
  resolution,
  children,
}: {
  resolution: EnvironmentResolution;
  children?: ReactNode;
}) {
  usePublishEnvironment(resolution);
  return children;
}

/** A WorldEnvironment at `order` in the tree, with `children` below it. */
function PublisherAt({
  order,
  resolution,
  children,
}: {
  order: TreeOrder;
  resolution: EnvironmentResolution;
  children?: ReactNode;
}) {
  return (
    <TreeOrderProvider order={order}>
      <PublishingNode resolution={resolution}>{children}</PublishingNode>
    </TreeOrderProvider>
  );
}

function appliedName(renderer: Renderer): unknown {
  const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
  return layer.props.userData.settings.name;
}

function inRoot(children: ReactNode, showPreviewEnvironment = true, showPreviewSun = true) {
  return (
    <ViewportModeProvider
      initialShowPreviewEnvironment={showPreviewEnvironment}
      initialShowPreviewSun={showPreviewSun}
    >
      <WorldEnvironmentScope world="root">{children}</WorldEnvironmentScope>
    </ViewportModeProvider>
  );
}

function inSubViewport(children: ReactNode) {
  return <WorldEnvironmentScope world="subViewport">{children}</WorldEnvironmentScope>;
}

function previewSunCount(renderer: Renderer): number {
  return renderer.scene.findAll((node) => node.props.name === 'PreviewSun').length;
}

describe('<WorldEnvironmentScope world="root">', () => {
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
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={NO_RESOLUTION} />));
    expect(mountedLayers(renderer)).toEqual(['NoEnvironmentLayer']);
  });

  it('draws nothing while the Environment loads', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<Publisher resolution={PENDING_RESOLUTION} />)
    );
    expect(mountedLayers(renderer)).toEqual([]);
  });

  it('passes over a WorldEnvironment with no valid Environment to the next one', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <Publisher resolution={NO_RESOLUTION} />
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
    const renderer = await ReactThreeTestRenderer.create(tree(PENDING_RESOLUTION));
    await renderer.update(tree(resolved('first')));
    const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
    expect(layer.props.userData.settings).toEqual({ name: 'first' });
  });

  it('puts an ancestor WorldEnvironment ahead of its descendant, as tree order does', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <PublisherAt order={[0]} resolution={resolved('ancestor')}>
          <PublisherAt order={[0, 0]} resolution={resolved('descendant')} />
        </PublisherAt>
      )
    );
    expect(appliedName(renderer)).toBe('ancestor');
  });

  it('gives a WorldEnvironment that mounts late its place in tree order', async () => {
    const tree = (hasEarlier: boolean) =>
      inRoot(
        <>
          {hasEarlier && <PublisherAt order={[0]} resolution={resolved('earlier')} />}
          <PublisherAt order={[1]} resolution={resolved('later')} />
        </>
      );
    const renderer = await ReactThreeTestRenderer.create(tree(false));
    await renderer.update(tree(true));
    expect(appliedName(renderer)).toBe('earlier');
  });

  it('follows a WorldEnvironment that moves ahead in the tree without remounting', async () => {
    const tree = (aOrder: TreeOrder, bOrder: TreeOrder) =>
      inRoot(
        <>
          <PublisherAt key="a" order={aOrder} resolution={resolved('a')} />
          <PublisherAt key="b" order={bOrder} resolution={resolved('b')} />
        </>
      );
    const renderer = await ReactThreeTestRenderer.create(tree([0], [1]));
    await renderer.update(tree([1], [0]));
    expect(appliedName(renderer)).toBe('b');
  });

  it('returns to the preview when the WorldEnvironment leaves', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(<Publisher resolution={resolved('a')} />));
    await renderer.update(inRoot(null));
    expect(mountedLayers(renderer)).toEqual(['PreviewEnvironment']);
  });
});

describe('<WorldEnvironmentScope world="root"> preview sun', () => {
  it('draws the preview sun for a scene with no DirectionalLight3D', async () => {
    expect(previewSunCount(await ReactThreeTestRenderer.create(inRoot(null)))).toBe(1);
  });

  it('draws no preview sun when the user turns it off', async () => {
    expect(previewSunCount(await ReactThreeTestRenderer.create(inRoot(null, true, false)))).toBe(0);
  });

  it('keeps the preview sun while the Environment loads (edge case)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<Publisher resolution={PENDING_RESOLUTION} />)
    );
    expect(previewSunCount(renderer)).toBe(1);
  });
});

describe('<WorldEnvironmentScope world="subViewport">', () => {
  it('draws a resolved Environment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inSubViewport(<Publisher resolution={resolved('a')} />)
    );
    expect(mountedLayers(renderer)).toEqual(['EnvironmentLayer']);
  });

  it('adds no layer for a missing Environment, so the pass keeps its own clear colour', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inSubViewport(<Publisher resolution={NO_RESOLUTION} />)
    );
    expect(mountedLayers(renderer)).toEqual([]);
  });

  it('draws no preview sun, which belongs to the root world', async () => {
    expect(previewSunCount(await ReactThreeTestRenderer.create(inSubViewport(null)))).toBe(0);
  });

  it('keeps its WorldEnvironment out of the root world', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(inSubViewport(<Publisher resolution={resolved('a')} />))
    );
    expect(mountedLayers(renderer).sort()).toEqual(['EnvironmentLayer', 'PreviewEnvironment']);
  });
});

describe('usePublishEnvironment', () => {
  it('refuses a WorldEnvironment outside any world', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(ReactThreeTestRenderer.create(<Publisher resolution={NO_RESOLUTION} />)).rejects.toThrow(
      /expected a world environment scope/
    );
  });
});

/**
 * Each world takes the CameraAttributes of the first WorldEnvironment that holds a valid one, apart
 * from which node holds the Environment (`world_environment.cpp:43-48`, `:87-93`). The factor its
 * consumers read is the attributes' `exposure_multiplier`, or none without attributes.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { TreeOrderProvider, type TreeOrder } from '../contexts/TreeOrderContext';
import type { EnvironmentLayerProps } from './EnvironmentLayer';
import { WorldEnvironmentScope, usePublishEnvironment } from './WorldEnvironmentScope';
import type { EnvironmentResolution } from './WorldEnvironmentScope';
import { NO_RESOLUTION, PENDING_RESOLUTION } from './worldGroup';
import {
  useExposureFactor,
  useExposureNormalization,
  usePublishCameraAttributes,
  type CameraAttributesResolution,
} from './worldExposure';

vi.mock('./EnvironmentLayer', () => ({
  EnvironmentLayer: ({ settings }: EnvironmentLayerProps) => (
    <group name="EnvironmentLayer" userData={{ settings }} />
  ),
}));
vi.mock('./NoEnvironmentLayer', () => ({ NoEnvironmentLayer: () => <group name="NoEnvironmentLayer" /> }));
vi.mock('../preview/PreviewEnvironment', () => ({
  PreviewEnvironment: () => <group name="PreviewEnvironment" />,
}));
vi.mock('../preview/PreviewSun', () => ({ PreviewSun: () => <group name="PreviewSun" /> }));

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function attributes(exposureMultiplier: number): CameraAttributesResolution {
  return { status: 'resolved', attributes: { exposureMultiplier } };
}

function environment(name: string): EnvironmentResolution {
  const settings = { name } as unknown as EnvironmentLayerProps['settings'];
  return {
    status: 'resolved',
    environment: { settings, sky: null, resources: NO_RESOURCES, skyResources: NO_RESOURCES },
  };
}

/** A WorldEnvironment at `order`: it publishes both slots, as the node does. */
function WorldEnvironmentAt({
  order,
  cameraAttributes = NO_RESOLUTION,
  env = NO_RESOLUTION,
}: {
  order: TreeOrder;
  cameraAttributes?: CameraAttributesResolution;
  env?: EnvironmentResolution;
}) {
  return (
    <TreeOrderProvider order={order}>
      <Publishing cameraAttributes={cameraAttributes} env={env} />
    </TreeOrderProvider>
  );
}

function Publishing({
  cameraAttributes,
  env,
}: {
  cameraAttributes: CameraAttributesResolution;
  env: EnvironmentResolution;
}) {
  usePublishEnvironment(env);
  usePublishCameraAttributes(cameraAttributes);
  return null;
}

/** Shows what a consumer in the world reads. */
function Reader() {
  const normalization = useExposureNormalization();
  const factor = useExposureFactor();
  return <group name="Reader" userData={{ normalization, factor }} />;
}

function read(renderer: Renderer): { normalization: number | null; factor: number } {
  return renderer.scene.find((node) => node.props.name === 'Reader').props.userData;
}

function inRoot(children: ReactNode) {
  return (
    <ViewportModeProvider>
      <WorldEnvironmentScope world="root">
        {children}
        <Reader />
      </WorldEnvironmentScope>
    </ViewportModeProvider>
  );
}

describe('the exposure of a world', () => {
  it('is none, and the factor 1, with no WorldEnvironment', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(null));
    expect(read(renderer)).toEqual({ normalization: null, factor: 1 });
  });

  it('is the exposure_multiplier of a camera_attributes-only WorldEnvironment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />)
    );
    expect(read(renderer)).toEqual({ normalization: 2, factor: 2 });
  });

  it('is none for a WorldEnvironment with only an Environment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} env={environment('a')} />)
    );
    expect(read(renderer)).toEqual({ normalization: null, factor: 1 });
  });

  it('keeps a multiplier of 0, which is a valid exposure and not no exposure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(0)} />)
    );
    expect(read(renderer)).toEqual({ normalization: 0, factor: 0 });
  });

  it('takes the first WorldEnvironment with valid attributes when two resolve', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(3)} />
          <WorldEnvironmentAt order={[1]} cameraAttributes={attributes(5)} />
        </>
      )
    );
    expect(read(renderer).factor).toBe(3);
  });

  it('passes over a WorldEnvironment with no valid attributes to the next one', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} env={environment('first')} />
          <WorldEnvironmentAt order={[1]} cameraAttributes={attributes(4)} />
        </>
      )
    );
    expect(read(renderer).factor).toBe(4);
  });

  it('takes the Environment and the attributes from two different WorldEnvironments', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} env={environment('first')} />
          <WorldEnvironmentAt order={[1]} env={environment('second')} cameraAttributes={attributes(2)} />
        </>
      )
    );
    const layer = renderer.scene.find((node) => node.props.name === 'EnvironmentLayer');
    expect(layer.props.userData.settings).toEqual({ name: 'first' });
    expect(read(renderer).factor).toBe(2);
  });

  it('holds the place of a first WorldEnvironment whose attributes still load', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={PENDING_RESOLUTION} />
          <WorldEnvironmentAt order={[1]} cameraAttributes={attributes(5)} />
        </>
      )
    );
    expect(read(renderer)).toEqual({ normalization: null, factor: 1 });
  });

  it('follows the attributes when they change', async () => {
    const tree = (multiplier: number) =>
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(multiplier)} />);
    const renderer = await ReactThreeTestRenderer.create(tree(2));
    await renderer.update(tree(6));
    expect(read(renderer).factor).toBe(6);
  });

  it('returns to none when the WorldEnvironment leaves', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />)
    );
    await renderer.update(inRoot(null));
    expect(read(renderer)).toEqual({ normalization: null, factor: 1 });
  });

  it('keeps a sub-viewport world apart from the root world', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <WorldEnvironmentScope world="subViewport">
            <WorldEnvironmentAt order={[1]} cameraAttributes={attributes(7)} />
            <Reader />
          </WorldEnvironmentScope>
        </>
      )
    );
    const factors = renderer.scene
      .findAll((node) => node.props.name === 'Reader')
      .map((node) => node.props.userData.factor);
    expect(factors.sort()).toEqual([2, 7]);
  });

  it('holds no exposure for a sub-viewport world without attributes, whatever the root holds', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <WorldEnvironmentScope world="subViewport">
            <Reader />
          </WorldEnvironmentScope>
        </>
      )
    );
    const normalizations = renderer.scene
      .findAll((node) => node.props.name === 'Reader')
      .map((node) => node.props.userData.normalization);
    expect(normalizations.sort()).toEqual([2, null]);
  });
});

describe('usePublishCameraAttributes', () => {
  it('refuses a WorldEnvironment outside any world', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      ReactThreeTestRenderer.create(<Publishing cameraAttributes={NO_RESOLUTION} env={NO_RESOLUTION} />)
    ).rejects.toThrow(/expected a world environment scope/);
  });
});

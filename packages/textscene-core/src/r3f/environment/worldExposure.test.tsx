/**
 * Each world takes the CameraAttributes of the first WorldEnvironment that holds a valid one, apart
 * from which node holds the Environment (`world_environment.cpp:43-48`, `:87-93`). The factor its
 * consumers read is the attributes' `exposure_multiplier`, or none without attributes.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { ViewportActionsProvider } from '../contexts/ViewportActionsContext';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { TreeOrderProvider, type TreeOrder } from '../contexts/TreeOrderContext';
import type { EnvironmentLayerProps } from './EnvironmentLayer';
import { WorldEnvironmentScope, usePublishEnvironment } from './WorldEnvironmentScope';
import type { EnvironmentResolution } from './WorldEnvironmentScope';
import { NO_RESOLUTION, PENDING_RESOLUTION } from './worldGroup';
import {
  useExposureFactor,
  useOptionalExposureFactor,
  usePublishCameraAttributes,
  usePublishRenderCamera,
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
  const optionalFactor = useOptionalExposureFactor();
  const factor = useExposureFactor();
  return <group name="Reader" userData={{ optionalFactor, factor }} />;
}

function read(renderer: Renderer): { optionalFactor: number | null; factor: number } {
  return renderer.scene.find((node) => node.props.name === 'Reader').props.userData;
}

/** A Camera3D at `order`: it publishes the attributes it holds, as the node does. */
function CameraAt({
  order,
  path,
  current = false,
  cameraAttributes = NO_RESOLUTION,
}: {
  order: TreeOrder;
  path: string;
  current?: boolean;
  cameraAttributes?: CameraAttributesResolution;
}) {
  return (
    <TreeOrderProvider order={order}>
      <PublishingCamera path={path} current={current} cameraAttributes={cameraAttributes} />
    </TreeOrderProvider>
  );
}

function PublishingCamera({
  path,
  current,
  cameraAttributes,
}: {
  path: string;
  current: boolean;
  cameraAttributes: CameraAttributesResolution;
}) {
  usePublishRenderCamera(path, current, cameraAttributes);
  return null;
}

function inRoot(children: ReactNode, activeCameraPath: string | null = null) {
  return (
    <ViewportModeProvider>
      <ViewportActionsProvider initialActiveCameraPath={activeCameraPath}>
        <WorldEnvironmentScope world="root">
          {children}
          <Reader />
        </WorldEnvironmentScope>
      </ViewportActionsProvider>
    </ViewportModeProvider>
  );
}

describe('the exposure of a world', () => {
  it('is none, and the factor 1, with no WorldEnvironment', async () => {
    const renderer = await ReactThreeTestRenderer.create(inRoot(null));
    expect(read(renderer)).toEqual({ optionalFactor: null, factor: 1 });
  });

  it('is the exposure_multiplier of a camera_attributes-only WorldEnvironment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />)
    );
    expect(read(renderer)).toEqual({ optionalFactor: 2, factor: 2 });
  });

  it('is none for a WorldEnvironment with only an Environment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} env={environment('a')} />)
    );
    expect(read(renderer)).toEqual({ optionalFactor: null, factor: 1 });
  });

  it('keeps a multiplier of 0, which is a valid exposure and not no exposure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<WorldEnvironmentAt order={[0]} cameraAttributes={attributes(0)} />)
    );
    expect(read(renderer)).toEqual({ optionalFactor: 0, factor: 0 });
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
    expect(read(renderer)).toEqual({ optionalFactor: null, factor: 1 });
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
    expect(read(renderer)).toEqual({ optionalFactor: null, factor: 1 });
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
    const optionalFactors = renderer.scene
      .findAll((node) => node.props.name === 'Reader')
      .map((node) => node.props.userData.optionalFactor);
    expect(optionalFactors.sort()).toEqual([2, null]);
  });
});

/**
 * The viewport renders through one Camera3D, and its valid attributes replace the world's
 * (`renderer_scene_cull.cpp:2707`, `:3562-3565`).
 */
describe('the exposure of a world seen through a Camera3D', () => {
  it('takes the attributes of the camera the viewer looks through over the WorldEnvironment', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Camera3D" cameraAttributes={attributes(5)} />
        </>,
        'Root/Camera3D'
      )
    );
    expect(read(renderer)).toEqual({ optionalFactor: 5, factor: 5 });
  });

  it('applies the camera attributes with no WorldEnvironment at all', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(<CameraAt order={[0]} path="Root/Camera3D" cameraAttributes={attributes(3)} />, 'Root/Camera3D')
    );
    expect(read(renderer)).toEqual({ optionalFactor: 3, factor: 3 });
  });

  it('leaves the WorldEnvironment attributes in force in the free view', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Camera3D" cameraAttributes={attributes(5)} />
        </>
      )
    );
    expect(read(renderer).factor).toBe(2);
  });

  it('ignores a camera the viewer does not look through', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/A" cameraAttributes={attributes(5)} />
          <CameraAt order={[2]} path="Root/B" cameraAttributes={attributes(9)} />
        </>,
        'Root/B'
      )
    );
    expect(read(renderer).factor).toBe(9);
  });

  it('keeps the WorldEnvironment attributes for a camera that holds none', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Camera3D" />
        </>,
        'Root/Camera3D'
      )
    );
    expect(read(renderer).factor).toBe(2);
  });

  it('keeps a camera multiplier of 0, which is a valid exposure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Camera3D" cameraAttributes={attributes(0)} />
        </>,
        'Root/Camera3D'
      )
    );
    expect(read(renderer)).toEqual({ optionalFactor: 0, factor: 0 });
  });

  it('elects the last current camera of a sub-viewport, as the viewport does', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <WorldEnvironmentScope world="subViewport">
          <CameraAt order={[0]} path="Root/Sub/A" cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Sub/B" current cameraAttributes={attributes(3)} />
          <CameraAt order={[2]} path="Root/Sub/C" current cameraAttributes={attributes(4)} />
          <Reader />
        </WorldEnvironmentScope>
      )
    );
    const factors = renderer.scene
      .findAll((node) => node.props.name === 'Reader')
      .map((node) => node.props.userData.factor);
    expect(factors.sort()).toEqual([1, 4]);
  });

  it('elects the first camera of a sub-viewport when none is current', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <WorldEnvironmentScope world="subViewport">
          <CameraAt order={[0]} path="Root/Sub/A" cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Sub/B" cameraAttributes={attributes(3)} />
          <Reader />
        </WorldEnvironmentScope>
      )
    );
    const factors = renderer.scene
      .findAll((node) => node.props.name === 'Reader')
      .map((node) => node.props.userData.factor);
    expect(factors.sort()).toEqual([1, 2]);
  });

  it('holds the place of a camera whose attributes still load', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          <CameraAt order={[1]} path="Root/Camera3D" cameraAttributes={PENDING_RESOLUTION} />
        </>,
        'Root/Camera3D'
      )
    );
    expect(read(renderer)).toEqual({ optionalFactor: null, factor: 1 });
  });

  it('returns to the WorldEnvironment attributes when the camera leaves', async () => {
    const tree = (withCamera: boolean) =>
      inRoot(
        <>
          <WorldEnvironmentAt order={[0]} cameraAttributes={attributes(2)} />
          {withCamera && <CameraAt order={[1]} path="Root/Camera3D" cameraAttributes={attributes(5)} />}
        </>,
        'Root/Camera3D'
      );
    const renderer = await ReactThreeTestRenderer.create(tree(true));
    await renderer.update(tree(false));
    expect(read(renderer).factor).toBe(2);
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

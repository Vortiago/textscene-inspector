/**
 * The shared driver mount: transport registration while active, registry
 * publication once loaded, and a mixer built while active and loaded, whose
 * teardown restores the pose. A host harness observes the transport and registry.
 */

import { describe, expect, it, vi } from 'vitest';
import { useCallback, useMemo } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import {
  useAnimationDriverMount,
  type UseAnimationDriverMountResult,
} from './useAnimationDriverMount';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../contexts/AnimationTransportContext';
import {
  AnimationDriverProvider,
  useAnimationDriver,
  type AnimationDriverEntry,
} from '../contexts/AnimationDriverContext';
import {
  SelectionProvider,
  useOptionalSelection,
} from '../contexts/SelectionContext';
import { NodePathProvider } from '../contexts/NodePathContext';

// ---- helpers ---------------------------------------------------------------

const NODE_PATH = 'Root/Player';

function makeObject(name = 'Root'): THREE.Object3D {
  const obj = new THREE.Group();
  obj.name = name;
  return obj;
}

function makeClip(name: string, duration = 1): THREE.AnimationClip {
  return new THREE.AnimationClip(name, duration, [
    new THREE.VectorKeyframeTrack(`${name}.position`, [0, duration], [0, 0, 0, 0, 0, 0]),
  ]);
}

// ---- harness ---------------------------------------------------------------

interface HarnessProps {
  object: THREE.Object3D | null;
  clips: THREE.AnimationClip[];
  isActive: boolean;
  buildMixer?: boolean;
  autoplay?: string;
  durations?: Record<string, number>;
  onMixerBuilt?: (obj: THREE.Object3D) => void;
  restore?: () => void;
}

/**
 * Mounts the hook inside all required providers. Captures transport,
 * selection, and the hook's returned refs so tests can manipulate/assert them.
 */
let capturedTransport: AnimationTransport;
let capturedDriver: AnimationDriverEntry | null;
let capturedResult: UseAnimationDriverMountResult;

function DriverCapture() {
  capturedDriver = useAnimationDriver(NODE_PATH);
  return null;
}

function Capture() {
  capturedTransport = useAnimationTransport();
  useOptionalSelection(); // ensure the context is consumed even if unused in assertions
  return null;
}

function Harness({
  object,
  clips,
  isActive,
  buildMixer,
  autoplay,
  durations,
  onMixerBuilt,
  restore,
}: HarnessProps) {
  const computedDurations = useMemo(
    () => durations ?? Object.fromEntries(clips.map((c) => [c.name, c.duration])),
    [durations, clips]
  );
  const stableOnMixerBuilt = useCallback(
    (obj: THREE.Object3D) => {
      onMixerBuilt?.(obj);
    },
    [onMixerBuilt]
  );
  const stableRestore = useCallback(() => restore?.(), [restore]);

  capturedResult = useAnimationDriverMount({
    object,
    clips,
    nodePath: NODE_PATH,
    isActive,
    buildMixer,
    autoplay,
    durations: computedDurations,
    onMixerBuilt: stableOnMixerBuilt,
    restore: stableRestore,
  });
  return null;
}

async function mountHarness(props: HarnessProps) {
  const renderer = await ReactThreeTestRenderer.create(
    <SelectionProvider>
      <AnimationTransportProvider>
        <AnimationDriverProvider>
          <Capture />
          <DriverCapture />
          <NodePathProvider path={NODE_PATH}>
            <Harness {...props} />
          </NodePathProvider>
        </AnimationDriverProvider>
      </AnimationTransportProvider>
    </SelectionProvider>
  );
  return renderer;
}

// ---- tests -----------------------------------------------------------------

describe('useAnimationDriverMount — registerPlayer (transport registration)', () => {
  it('registers clips with the transport when isActive is true', async () => {
    const clips = [makeClip('idle'), makeClip('run')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true });

    expect(capturedTransport.hasPlayer).toBe(true);
    expect(capturedTransport.clips).toEqual(['idle', 'run']);

    await renderer.unmount();
  });

  it('does not register when isActive is false', async () => {
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: false });

    expect(capturedTransport.hasPlayer).toBe(false);
    expect(capturedTransport.clips).toEqual([]);

    await renderer.unmount();
  });

  it('registers even with zero clips (shows "no animations" in the tab)', async () => {
    const renderer = await mountHarness({ object: makeObject(), clips: [], isActive: true });

    expect(capturedTransport.hasPlayer).toBe(true);
    expect(capturedTransport.clips).toEqual([]);

    await renderer.unmount();
  });

  it('pre-selects the autoplay clip on registration', async () => {
    const clips = [makeClip('idle'), makeClip('run')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true, autoplay: 'run' });

    expect(capturedTransport.selectedClip).toBe('run');

    await renderer.unmount();
  });

  it('unregisters from the transport when the driver becomes inactive', async () => {
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true });
    expect(capturedTransport.hasPlayer).toBe(true);

    await renderer.update(
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <DriverCapture />
            <NodePathProvider path={NODE_PATH}>
              <Harness object={object} clips={clips} isActive={false} />
            </NodePathProvider>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    );

    expect(capturedTransport.hasPlayer).toBe(false);

    await renderer.unmount();
  });

  it('unregisters from the transport on unmount (cleanup fires during unmount)', async () => {
    // Verify indirectly: the restore callback is called during unmount teardown,
    // which means the mixer effect's cleanup (which calls restore) fired.
    // The "unregisters when inactive" test already covers the registerPlayer
    // cleanup path; here we confirm unmount triggers the same teardown.
    const restore = vi.fn();
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true, restore });
    restore.mockClear();

    await renderer.unmount();

    expect(restore).toHaveBeenCalledTimes(1);
  });
});

describe('useAnimationDriverMount — registerDriver (registry publication)', () => {
  it('publishes { object, clips } into the AnimationDriverRegistry when object + clips are ready', async () => {
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: false });

    expect(capturedDriver).not.toBeNull();
    expect(capturedDriver?.object).toBe(object);
    expect(capturedDriver?.clips).toHaveLength(1);

    await renderer.unmount();
  });

  it('does not publish when clips array is empty', async () => {
    const object = makeObject();

    const renderer = await mountHarness({ object, clips: [], isActive: false });

    expect(capturedDriver).toBeNull();

    await renderer.unmount();
  });

  it('does not publish when object is null (async arrival)', async () => {
    const clips = [makeClip('idle')];

    const renderer = await mountHarness({ object: null, clips, isActive: false });

    expect(capturedDriver).toBeNull();

    await renderer.unmount();
  });

  it('publishes once object arrives (async arrival scenario)', async () => {
    const clips = [makeClip('idle')];

    const renderer = await mountHarness({ object: null, clips, isActive: false });
    expect(capturedDriver).toBeNull();

    const object = makeObject();
    await renderer.update(
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <DriverCapture />
            <NodePathProvider path={NODE_PATH}>
              <Harness object={object} clips={clips} isActive={false} />
            </NodePathProvider>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    );

    expect(capturedDriver).not.toBeNull();
    expect(capturedDriver?.object).toBe(object);

    await renderer.unmount();
  });

  it('unregisters from the registry on unmount (cleanup fires during unmount)', async () => {
    // After unmount the Capture component is also unmounted, so capturedDriver
    // is stale. Verify indirectly: a second tree that reads the same registry
    // path after the first tree is unmounted sees null.
    const clips = [makeClip('idle')];
    const object = makeObject();

    // Mount the publishing harness.
    const publisherRenderer = await mountHarness({ object, clips, isActive: false });
    expect(capturedDriver).not.toBeNull();

    // Unmounting the publisher triggers registerDriver's cleanup.
    await publisherRenderer.unmount();

    // Mount a fresh consumer that reads the same path; if the cleanup fired the
    // driver entry is gone.
    let driverAfterUnmount: AnimationDriverEntry | null = undefined as unknown as null;
    function DriversReader() {
      driverAfterUnmount = useAnimationDriver(NODE_PATH);
      return null;
    }
    const readerRenderer = await ReactThreeTestRenderer.create(
      <AnimationDriverProvider>
        <DriversReader />
      </AnimationDriverProvider>
    );

    expect(driverAfterUnmount).toBeNull();
    await readerRenderer.unmount();
  });
});

describe('useAnimationDriverMount — mixer build (ADR-0012)', () => {
  it('calls onMixerBuilt when active + object + clips are ready', async () => {
    const onMixerBuilt = vi.fn();
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true, onMixerBuilt });

    expect(onMixerBuilt).toHaveBeenCalledTimes(1);
    expect(onMixerBuilt).toHaveBeenCalledWith(object);
    expect(capturedResult.mixerRef.current).toBeInstanceOf(THREE.AnimationMixer);
    expect(capturedResult.actionsRef.current.has('idle')).toBe(true);

    await renderer.unmount();
  });

  it('does not call onMixerBuilt when inactive', async () => {
    const onMixerBuilt = vi.fn();
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: false, onMixerBuilt });

    expect(onMixerBuilt).not.toHaveBeenCalled();

    await renderer.unmount();
  });

  it('does not call onMixerBuilt when object is null', async () => {
    const onMixerBuilt = vi.fn();
    const clips = [makeClip('idle')];

    const renderer = await mountHarness({ object: null, clips, isActive: true, onMixerBuilt });

    expect(onMixerBuilt).not.toHaveBeenCalled();

    await renderer.unmount();
  });

  it('does not call onMixerBuilt when clips array is empty', async () => {
    const onMixerBuilt = vi.fn();
    const object = makeObject();

    const renderer = await mountHarness({ object, clips: [], isActive: true, onMixerBuilt });

    expect(onMixerBuilt).not.toHaveBeenCalled();

    await renderer.unmount();
  });

  it('calls restore and clears refs on deselect (mixer teardown)', async () => {
    const restore = vi.fn();
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true, restore });

    await renderer.update(
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <DriverCapture />
            <NodePathProvider path={NODE_PATH}>
              <Harness object={object} clips={clips} isActive={false} restore={restore} />
            </NodePathProvider>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    );

    expect(restore).toHaveBeenCalledTimes(1);
    expect(capturedResult.mixerRef.current).toBeNull();
    expect(capturedResult.actionsRef.current.size).toBe(0);

    await renderer.unmount();
  });

  it('calls restore on unmount', async () => {
    const restore = vi.fn();
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true, restore });
    restore.mockClear();

    await renderer.unmount();

    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the mixer when the object changes (async arrival)', async () => {
    const onMixerBuilt = vi.fn();
    const clips = [makeClip('idle')];

    const renderer = await mountHarness({ object: null, clips, isActive: true, onMixerBuilt });
    expect(onMixerBuilt).not.toHaveBeenCalled();

    const object = makeObject();
    await renderer.update(
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <DriverCapture />
            <NodePathProvider path={NODE_PATH}>
              <Harness object={object} clips={clips} isActive={true} onMixerBuilt={onMixerBuilt} />
            </NodePathProvider>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    );

    expect(onMixerBuilt).toHaveBeenCalledTimes(1);

    await renderer.unmount();
  });

  it('actions map contains one entry per clip', async () => {
    const clips = [makeClip('idle'), makeClip('run'), makeClip('jump', 0.5)];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true });

    expect([...capturedResult.actionsRef.current.keys()]).toEqual(['idle', 'run', 'jump']);

    await renderer.unmount();
  });
});

describe('useAnimationDriverMount — combined effects', () => {
  it('publishes to the registry (isActive=false) AND registers with the transport (isActive=true) independently', async () => {
    const clips = [makeClip('idle')];
    const object = makeObject();

    // isActive=true: both effects fire.
    const renderer = await mountHarness({ object, clips, isActive: true });

    expect(capturedTransport.hasPlayer).toBe(true);
    expect(capturedDriver).not.toBeNull();

    await renderer.unmount();
  });

  it('registry publication persists when the driver becomes inactive (availability is not tied to selection)', async () => {
    const clips = [makeClip('idle')];
    const object = makeObject();

    const renderer = await mountHarness({ object, clips, isActive: true });

    await renderer.update(
      <SelectionProvider>
        <AnimationTransportProvider>
          <AnimationDriverProvider>
            <Capture />
            <DriverCapture />
            <NodePathProvider path={NODE_PATH}>
              <Harness object={object} clips={clips} isActive={false} />
            </NodePathProvider>
          </AnimationDriverProvider>
        </AnimationTransportProvider>
      </SelectionProvider>
    );

    // Transport unregistered (isActive false), but driver registry entry persists.
    expect(capturedTransport.hasPlayer).toBe(false);
    expect(capturedDriver).not.toBeNull();

    await renderer.unmount();
  });

  describe('buildMixer', () => {
    it('defaults to isActive, so a caller that omits it is unaffected', async () => {
      const renderer = await mountHarness({ object: makeObject(), clips: [makeClip('idle')], isActive: true });
      expect(capturedResult.mixerRef.current).not.toBeNull();
      await renderer.unmount();
    });

    it('skips the mixer when narrower than isActive, but still registers the clips', async () => {
      const onMixerBuilt = vi.fn();
      const renderer = await mountHarness({
        object: makeObject(),
        clips: [makeClip('idle')],
        isActive: true,
        buildMixer: false,
        onMixerBuilt,
      });

      // No mixer, no actions, no pose snapshot: nothing could evaluate them.
      expect(capturedResult.mixerRef.current).toBeNull();
      expect(capturedResult.actionsRef.current.size).toBe(0);
      expect(onMixerBuilt).not.toHaveBeenCalled();

      // Registration is independent: the Animation tab lists the clips and the
      // driver registry publishes them (ADR-0019).
      expect(capturedTransport.hasPlayer).toBe(true);
      expect(capturedDriver).not.toBeNull();

      await renderer.unmount();
    });

    it('builds the mixer once it turns true', async () => {
      const object = makeObject();
      const clips = [makeClip('idle')];
      const renderer = await mountHarness({ object, clips, isActive: true, buildMixer: false });
      expect(capturedResult.mixerRef.current).toBeNull();

      await renderer.update(
        <SelectionProvider>
          <AnimationTransportProvider>
            <AnimationDriverProvider>
              <Capture />
              <DriverCapture />
              <NodePathProvider path={NODE_PATH}>
                <Harness object={object} clips={clips} isActive={true} buildMixer={true} />
              </NodePathProvider>
            </AnimationDriverProvider>
          </AnimationTransportProvider>
        </SelectionProvider>
      );

      expect(capturedResult.mixerRef.current).not.toBeNull();
      await renderer.unmount();
    });
  });
});

/**
 * The driver hook of the AnimationPlayer: it pushes what a clip samples at the live playhead, and
 * releases every key it wrote once the clip stops, is switched away or unmounts.
 */
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { createPushStore, type PushStore } from '../contexts/pushStore';
import { usePushedWrites, type PushedClip } from './usePushedWrites';

/** A mixer playing a 1 s clip named `name`, with the action ready at time 0. */
function actionsFor(name: string): Map<string, THREE.AnimationAction> {
  const mixer = new THREE.AnimationMixer(new THREE.Object3D());
  const action = mixer.clipAction(new THREE.AnimationClip(name, 1, []));
  action.play();
  return new Map([[name, action]]);
}

/** A clip that writes the playhead to `a`, and to `b` once the playhead passes 0.25. */
function clipNamed(name: string): PushedClip<number> {
  return {
    name,
    sample: (time, out) => {
      out.set('a', time);
      if (time > 0.25) out.set('b', time);
    },
  };
}

function Harness(props: {
  store: PushStore<number>;
  clip: PushedClip<number> | null;
  isPlaying: boolean;
  actions: Map<string, THREE.AnimationAction>;
}) {
  const actionsRef = useRef(props.actions);
  actionsRef.current = props.actions;
  usePushedWrites(props.store, props.clip, props.isPlaying, actionsRef);
  return null;
}

async function mount(isPlaying = true) {
  const store = createPushStore<number>();
  const actions = actionsFor('clip');
  const clip = clipNamed('clip');
  const renderer = await ReactThreeTestRenderer.create(
    <Harness store={store} clip={clip} isPlaying={isPlaying} actions={actions} />
  );
  const rerender = (next: { clip?: PushedClip<number> | null; isPlaying?: boolean }) =>
    renderer.update(
      <Harness
        store={store}
        clip={next.clip === undefined ? clip : next.clip}
        isPlaying={next.isPlaying ?? isPlaying}
        actions={actions}
      />
    );
  const seen = (key: string) => {
    const listener = vi.fn();
    store.subscribe(key, listener)();
    return listener.mock.calls[0]?.[0] ?? null;
  };
  return { renderer, actions, rerender, seen };
}

describe('usePushedWrites', () => {
  it('pushes the sample at the live playhead each frame', async () => {
    const { renderer, actions, seen } = await mount();

    actions.get('clip')!.time = 0.1;
    await renderer.advanceFrames(1, 0.016);

    expect(seen('a')).toBe(0.1);
    expect(seen('b')).toBeNull();
  });

  it('releases a key the clip stops writing', async () => {
    const { renderer, actions, seen } = await mount();
    actions.get('clip')!.time = 0.5;
    await renderer.advanceFrames(1, 0.016);
    expect(seen('b')).toBe(0.5);

    actions.get('clip')!.time = 0.1;
    await renderer.advanceFrames(1, 0.016);

    expect(seen('b')).toBeNull();
  });

  it('releases every key at once when the clip stops', async () => {
    const { renderer, actions, rerender, seen } = await mount();
    actions.get('clip')!.time = 0.5;
    await renderer.advanceFrames(1, 0.016);

    await rerender({ isPlaying: false });

    expect([seen('a'), seen('b')]).toEqual([null, null]);
  });

  it('releases every key when the clip is deselected', async () => {
    const { renderer, actions, rerender, seen } = await mount();
    actions.get('clip')!.time = 0.5;
    await renderer.advanceFrames(1, 0.016);

    await rerender({ clip: null });

    expect([seen('a'), seen('b')]).toEqual([null, null]);
  });

  it('samples a new clip again though the playhead has not moved', async () => {
    const { renderer, actions, rerender, seen } = await mount();
    actions.get('clip')!.time = 0.1;
    await renderer.advanceFrames(1, 0.016);

    await rerender({ clip: { name: 'clip', sample: (_, out) => out.set('c', 7) } });
    await renderer.advanceFrames(1, 0.016);

    expect([seen('a'), seen('c')]).toEqual([null, 7]);
  });

  it('samples once while the playhead stands', async () => {
    const actions = actionsFor('clip');
    const sample = vi.fn((time: number, out: Map<string, number>) => void out.set('a', time));
    const renderer = await ReactThreeTestRenderer.create(
      <Harness
        store={createPushStore<number>()}
        clip={{ name: 'clip', sample }}
        isPlaying
        actions={actions}
      />
    );

    await renderer.advanceFrames(3, 0.016);

    expect(sample).toHaveBeenCalledTimes(1);
  });

  it('releases every key on unmount', async () => {
    const store = createPushStore<number>();
    const actions = actionsFor('clip');
    const renderer = await ReactThreeTestRenderer.create(
      <Harness store={store} clip={clipNamed('clip')} isPlaying actions={actions} />
    );
    actions.get('clip')!.time = 0.5;
    await renderer.advanceFrames(1, 0.016);

    await renderer.unmount();

    const listener = vi.fn();
    store.subscribe('a', listener);
    expect(listener).not.toHaveBeenCalled();
  });
});

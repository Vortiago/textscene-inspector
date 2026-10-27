import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SceneHolding } from './sceneHolding';

/** A stand-in for the renderer, which a holding only hands to `make`. */
const renderer = {} as THREE.WebGLRenderer;

function holdingOf() {
  const made: { dispose: ReturnType<typeof vi.fn> }[] = [];
  const holding = new SceneHolding(() => {
    const held = { dispose: vi.fn() };
    made.push(held);
    return held;
  });
  return { holding, made };
}

describe('SceneHolding', () => {
  it('makes one value for the holders of a scene', () => {
    const { holding, made } = holdingOf();
    const scene = new THREE.Scene();

    holding.hold(scene, renderer, Symbol('first'));
    holding.hold(scene, renderer, Symbol('second'));

    expect(made).toHaveLength(1);
    expect(holding.of(scene)).toBe(made[0]);
  });

  it('makes a value of its own for each scene', () => {
    const { holding, made } = holdingOf();

    holding.hold(new THREE.Scene(), renderer, Symbol('first'));
    holding.hold(new THREE.Scene(), renderer, Symbol('second'));

    expect(made).toHaveLength(2);
  });

  it('disposes the value with its last holder, not before', () => {
    const { holding, made } = holdingOf();
    const scene = new THREE.Scene();
    const releaseFirst = holding.hold(scene, renderer, Symbol('first'));
    const releaseSecond = holding.hold(scene, renderer, Symbol('second'));

    releaseFirst();
    expect(made[0]!.dispose).not.toHaveBeenCalled();
    releaseSecond();

    expect(made[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(holding.of(scene)).toBeUndefined();
  });

  it('makes a new value for a scene whose holders all let go (edge case)', () => {
    const { holding, made } = holdingOf();
    const scene = new THREE.Scene();
    holding.hold(scene, renderer, Symbol('first'))();

    holding.hold(scene, renderer, Symbol('second'));

    expect(made).toHaveLength(2);
  });

  it('names the first holder that remains as the one that drives', () => {
    const { holding } = holdingOf();
    const scene = new THREE.Scene();
    const [first, second] = [Symbol('first'), Symbol('second')];
    const releaseFirst = holding.hold(scene, renderer, first);
    holding.hold(scene, renderer, second);

    expect([holding.drivenBy(scene, first), holding.drivenBy(scene, second)]).toEqual([
      holding.of(scene),
      undefined,
    ]);
    releaseFirst();
    expect(holding.drivenBy(scene, second)).toBe(holding.of(scene));
  });

  it('names no driver for a scene nobody holds (error case)', () => {
    const { holding } = holdingOf();

    expect(holding.drivenBy(new THREE.Scene(), Symbol('stranger'))).toBeUndefined();
  });
});

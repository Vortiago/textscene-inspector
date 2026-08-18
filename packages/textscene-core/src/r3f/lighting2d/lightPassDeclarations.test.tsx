/**
 * What a declaration keyed on a cull tuple must survive: a re-render.
 *
 * A light rebuilds its key object on every re-render, so a declaration that
 * depended on the object would withdraw and re-declare on a render that changed
 * nothing — reshuffling every ordinal in the class, and with them the stencil
 * refs the shadow stamps are kept apart by. Every keyed declaration in this
 * module shares that requirement, so every one of them is pinned here.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import {
  CanvasLighting2DContext,
  type CanvasLighting2D,
  type CanvasLightSlot,
} from './lightPassContext';
import { DEFAULT_LIGHT_CULL_KEY, type LightCullKey } from './lightCullKey';
import { useRegisterCanvasLight2D, useRegisterShadowTint } from './lightPassDeclarations';
import * as THREE from 'three';

/** A lighting context whose two keyed registrars are spies. */
function spyLighting() {
  const release = vi.fn();
  const releaseTint = vi.fn();
  const slot: CanvasLightSlot = { ordinal: 0, release };
  const register = vi.fn((_key: LightCullKey) => slot);
  const registerShadowTint = vi.fn((_key: LightCullKey) => releaseTint);
  const value: CanvasLighting2D = {
    classes: [],
    resolution: new THREE.Vector2(1, 1),
    register,
    registerLightOnly: () => () => {},
    registerShadowTint,
  };
  const Wrap = ({ children }: { children: ReactNode }) => (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
  return { Wrap, register, release, registerShadowTint, releaseTint };
}

/**
 * Both keyed declarations, under one component that rebuilds its key object on
 * every render — which is what a real light component does.
 */
function Light({ cullKey }: { cullKey: LightCullKey }) {
  useRegisterCanvasLight2D(true, { ...cullKey });
  useRegisterShadowTint(true, { ...cullKey });
  return null;
}

const OTHER_TUPLE: LightCullKey = { ...DEFAULT_LIGHT_CULL_KEY, itemCullMask: 2 };

describe('a declaration keyed on a cull tuple', () => {
  it('survives a re-render that leaves every number unchanged', () => {
    const { Wrap, register, release, registerShadowTint, releaseTint } = spyLighting();

    const { rerender } = render(
      <Wrap>
        <Light cullKey={DEFAULT_LIGHT_CULL_KEY} />
      </Wrap>
    );
    expect(register).toHaveBeenCalledTimes(1);
    expect(registerShadowTint).toHaveBeenCalledTimes(1);

    // A fresh key object carrying the very same five numbers.
    rerender(
      <Wrap>
        <Light cullKey={{ ...DEFAULT_LIGHT_CULL_KEY }} />
      </Wrap>
    );

    expect(register).toHaveBeenCalledTimes(1);
    expect(registerShadowTint).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
    expect(releaseTint).not.toHaveBeenCalled();
  });

  it('is withdrawn and remade when a number in the tuple does change', () => {
    // The other half of the contract: pinning only the survival above would be
    // satisfied by a declaration that never re-declares at all.
    const { Wrap, register, release, registerShadowTint, releaseTint } = spyLighting();

    const { rerender } = render(
      <Wrap>
        <Light cullKey={DEFAULT_LIGHT_CULL_KEY} />
      </Wrap>
    );
    rerender(
      <Wrap>
        <Light cullKey={OTHER_TUPLE} />
      </Wrap>
    );

    expect(register).toHaveBeenCalledTimes(2);
    expect(registerShadowTint).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(1);
    expect(releaseTint).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[1]![0]).toEqual(OTHER_TUPLE);
    expect(registerShadowTint.mock.calls[1]![0]).toEqual(OTHER_TUPLE);
  });
});

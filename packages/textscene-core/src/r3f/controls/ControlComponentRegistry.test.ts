/**
 * `ControlComponentRegistry` maps a Control `type` string to its native
 * (WebGL canvas) painter, plus the `wrapsChildren` flag a passthrough type
 * (`CanvasLayer`, `ScrollContainer`) opts into.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { controlComponentRegistry, type NativeControlComponent } from './ControlComponentRegistry';

const TYPE = 'TestRegistryProbeType';
const NativeStub: NativeControlComponent = () => null;

afterEach(() => {
  // This file never imports the native slice barrels, so the registry holds
  // only what this suite puts in it — a full clear is safe here.
  controlComponentRegistry.clear();
});

describe('ControlComponentRegistry', () => {
  it('registers a native painter under its type name', () => {
    controlComponentRegistry.register({ typeName: TYPE, Component: NativeStub });
    expect(controlComponentRegistry.get(TYPE)).toBe(NativeStub);
  });

  it('get returns undefined for an unregistered type', () => {
    expect(controlComponentRegistry.get('NoSuchType')).toBeUndefined();
  });

  it('defaults wrapsChildren to false when not declared', () => {
    controlComponentRegistry.register({ typeName: TYPE, Component: NativeStub });
    expect(controlComponentRegistry.wrapsChildren(TYPE)).toBe(false);
  });

  it('honours wrapsChildren: true on the registration', () => {
    controlComponentRegistry.register({ typeName: TYPE, Component: NativeStub, wrapsChildren: true });
    expect(controlComponentRegistry.wrapsChildren(TYPE)).toBe(true);
  });
});

/**
 * `ControlComponentRegistry` carries the DOM `Component` every registered
 * Control type has always had, plus an optional native (WebGL canvas)
 * `Native` painter a slice registers alongside it once its native painter
 * exists. `get()` (the pre-existing DOM lookup) must stay untouched — a
 * registration with no `Native` yet is exactly what every current slice is.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  controlComponentRegistry,
  type ControlComponent,
  type NativeControlComponent,
} from './ControlComponentRegistry';

const TYPE = 'TestRegistryProbeType';
const DomStub: ControlComponent = () => null;
const NativeStub: NativeControlComponent = () => null;

afterEach(() => {
  // This file never imports the DOM/native slice barrels, so the registry
  // holds only what this suite puts in it — a full clear is safe here.
  controlComponentRegistry.clear();
});

describe('ControlComponentRegistry — Native field', () => {
  it('registers with only a DOM Component (existing shape, no Native)', () => {
    controlComponentRegistry.register({ typeName: TYPE, Component: DomStub });
    expect(controlComponentRegistry.get(TYPE)).toBe(DomStub);
    expect(controlComponentRegistry.getNative(TYPE)).toBeUndefined();
  });

  it('carries both Component and Native when a slice registers both', () => {
    controlComponentRegistry.register({ typeName: TYPE, Component: DomStub, Native: NativeStub });
    expect(controlComponentRegistry.get(TYPE)).toBe(DomStub);
    expect(controlComponentRegistry.getNative(TYPE)).toBe(NativeStub);
  });

  it('getNative returns undefined for an unregistered type', () => {
    expect(controlComponentRegistry.getNative('NoSuchType')).toBeUndefined();
  });
});

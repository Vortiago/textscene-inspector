/**
 * MarginContainer registration — the 2D-overlay DOM component AND the native
 * (WebGL canvas) painter + rect solver, self-registered on import (ADR-0001's
 * convention, extended to `controlSolverRegistry` for the native rect solve).
 */

import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { MarginContainer } from './Component';
import { MarginContainerNative } from './NativeComponent';
import { marginContainerMinimumSize, marginContainerLayout } from './nativeSolver';

controlComponentRegistry.register({
  typeName: 'MarginContainer',
  Component: MarginContainer,
  Native: MarginContainerNative,
});
controlSolverRegistry.registerMinimumSize('MarginContainer', marginContainerMinimumSize);
controlSolverRegistry.registerContainerLayout('MarginContainer', marginContainerLayout);

export { MarginContainer, MarginContainerNative };

/**
 * A window class that is the root of its own Control canvas: a canvas boundary, its contents minimum
 * (which `wrap_controls` reads, so the window root's own rect never floors at it), its layout when it
 * places its children, and the painter of its chrome. Each registry matches one type name exactly.
 */
import {
  controlComponentRegistry,
  type NativeControlComponent,
} from '../../../r3f/controls/ControlComponentRegistry';
import {
  controlSolverRegistry,
  type ContainerLayoutFn,
  type LoadedMinimumSizeFn,
  type MinimumSizeFn,
} from '../../../r3f/controls/native/solverRegistry';

interface WindowControls {
  typeName: string;
  Component: NativeControlComponent;
  minimumSize: MinimumSizeFn;
  /** Absent where the window places no children. */
  layout?: ContainerLayoutFn;
  /** Absent where its own properties set no minimum at load. */
  loadedMinimumSize?: LoadedMinimumSizeFn;
}

export function registerWindowControls({
  typeName,
  Component,
  minimumSize,
  layout,
  loadedMinimumSize,
}: WindowControls): void {
  controlSolverRegistry.registerCanvasBoundary(typeName);
  controlSolverRegistry.registerMinimumSize(typeName, minimumSize);
  if (layout) controlSolverRegistry.registerContainerLayout(typeName, layout);
  if (loadedMinimumSize) controlSolverRegistry.registerLoadedMinimumSize(typeName, loadedMinimumSize);
  controlComponentRegistry.register({ typeName, Component });
}

/**
 * BoxContainer's native (WebGL canvas) rect solve: `../shared/boxContainerSolver.ts`
 * at the `vertical` this node authored (`box_container.cpp:380`). HBoxContainer
 * and VBoxContainer fix the axis by type instead.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';
import type { BoxContainerProperties } from './types';

/** `BoxContainer::vertical` (`box_container.h:44`). Godot default `false`. */
function verticalOf(props: BoxContainerProperties): boolean {
  return props.vertical ?? false;
}

export const boxContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const vertical = verticalOf(n.node.properties as BoxContainerProperties);
  return makeBoxContainerLayout(vertical)(n, children, contentRect, ctx);
};

export const boxContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const vertical = verticalOf(n.node.properties as BoxContainerProperties);
  return makeBoxContainerMinimumSize(vertical)(n, ctx);
};

controlSolverRegistry.registerContainerLayout('BoxContainer', boxContainerLayout);
controlSolverRegistry.registerMinimumSize('BoxContainer', boxContainerMinimumSize);

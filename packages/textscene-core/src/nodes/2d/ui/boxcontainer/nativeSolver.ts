/**
 * BoxContainer's native (WebGL canvas) rect solve — the shared BoxContainer
 * port at whichever `vertical` THIS node authored (`box_container.cpp:380`),
 * unlike HBoxContainer/VBoxContainer, whose axis is fixed by TYPE and baked
 * into their own `nativeSolver.ts` as a literal. The algorithm itself lives
 * once in `../shared/boxContainerSolver.ts`, shared by all four.
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

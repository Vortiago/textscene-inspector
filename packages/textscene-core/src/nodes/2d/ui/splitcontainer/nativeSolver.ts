/**
 * SplitContainer's native rect solve: `../shared/splitContainerSolver.ts` at the `vertical` this node
 * authored (`split_container.cpp:1299`). HSplitContainer and VSplitContainer fix the axis by type.
 */

import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import type { ContainerLayoutFn, MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import {
  makeSplitContainerLayout,
  makeSplitContainerMinimumSize,
  splitContainerTextureSlots,
} from '../shared/splitContainerSolver';
import type { SplitContainerProperties } from './types';

/** `SplitContainer::vertical` (`split_container.h:96`). Godot default `false`. */
function verticalOf(props: SplitContainerProperties): boolean {
  return props.vertical ?? false;
}

export const splitContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const vertical = verticalOf(n.node.properties as SplitContainerProperties);
  return makeSplitContainerLayout(vertical)(n, children, contentRect, ctx);
};

export const splitContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const vertical = verticalOf(n.node.properties as SplitContainerProperties);
  return makeSplitContainerMinimumSize(vertical)(n, ctx);
};

controlSolverRegistry.registerContainerLayout('SplitContainer', splitContainerLayout);
controlSolverRegistry.registerMinimumSize('SplitContainer', splitContainerMinimumSize);
controlSolverRegistry.registerTextureSlots('SplitContainer', splitContainerTextureSlots);

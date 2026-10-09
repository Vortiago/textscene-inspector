/**
 * The visibility-range cull of one camera over a scene's geometry instances, with their
 * visibility parents: which instances draw and the fade each draws at. A port of the dependency
 * pass `_visibility_cull` and the per-instance `VIS_CHECK` of `_scene_cull`
 * (`renderer_scene_cull.cpp:2719-2755`, `:2836-2939`).
 */

import {
  RangeCheck,
  VisibilityRangeFadeMode,
  checkVisibilityRange,
  hasVisibilityRange,
  selfFade,
} from './visibilityRange.js';
import type { VisibilityRange } from './visibilityRange.js';

export interface VisibilityCullInstance {
  range: VisibilityRange;
  /**
   * Whether the scene cull indexes it: a geometry base (`geometryBase.ts`) whose AABB has a surface
   * (`renderer_scene_cull.cpp:1675-1681`). A dependant of a parent it does not index has no parent.
   */
  isIndexed: boolean;
  /** The index of its visibility parent in the same list, or -1 for none. */
  parent: number;
  /** From the camera origin to the centre of its world AABB. */
  distance: number;
  /**
   * Whether the camera frustum or a directional shadow split holds its AABB. Godot range-checks
   * an instance without visibility dependants only then (`renderer_scene_cull.cpp:2852,3140`).
   */
  isInView: boolean;
  /** Whether this camera drew it at the last check: the `viewport_state` bit (`renderer_scene_cull.h:301`). */
  wasVisible: boolean;
}

export interface VisibilityCullResult {
  /** Whether it draws and casts into a directional shadow. */
  isVisible: boolean;
  /** Its SELF fade times its visibility parent's fade, before `transparency` multiplies in. */
  fade: number;
  /** The `viewport_state` bit for the next check. */
  wasVisible: boolean;
}

/** `InstanceData::FLAG_VISIBILITY_DEPENDENCY_*` (`renderer_scene_cull.h:272-275`). */
const HIDDEN_CLOSE_RANGE = 1 << 0;
const HIDDEN = 1 << 1;
const FADE_CHILDREN = 1 << 2;
/** Both hidden bits: the instance range-checks itself in the main pass. */
const NEEDS_CHECK = HIDDEN_CLOSE_RANGE | HIDDEN;

export function cullVisibility(instances: readonly VisibilityCullInstance[]): VisibilityCullResult[] {
  const parents = indexedParents(instances, acyclicParents(instances.map((instance) => instance.parent)));
  const depths = dependencyDepths(parents);
  const isListed = instances.map(isInVisibilityList);
  const wasVisible = instances.map((instance) => instance.wasVisible);
  const childrenFade = instances.map(() => 1);
  const flags = instances.map((instance, i) => initialFlags(instance, isListed[i]!, parents[i]!, depths[i]!));

  // Deepest first, so a parent's flags are final before its dependants read them (`:3224`).
  const dependencyPass = instances
    .map((_, i) => i)
    .filter((i) => isListed[i]! && depths[i]! > 0)
    .sort((a, b) => depths[b]! - depths[a]!);
  for (const i of dependencyPass) {
    const parent = parents[i]!;
    if (parent >= 0 && !showsDependants(flags[parent]!)) {
      flags[i] = HIDDEN;
      continue;
    }
    const { range, distance } = instances[i]!;
    const result = checkVisibilityRange(range, distance, wasVisible[i]!);
    wasVisible[i] = drawsAt(result.check);
    childrenFade[i] = result.childrenFade;
    flags[i] = DEPENDENCY_FLAGS[result.check];
  }

  return instances.map((instance, i) => {
    const isVisible = passesVisibilityCheck(instance, i);
    const parent = parents[i]!;
    const parentFade = parent >= 0 && flags[parent]! & FADE_CHILDREN ? childrenFade[parent]! : 1;
    const ownFade =
      isVisible && fadesItself(instance.range) ? selfFade(instance.range, instance.distance) : 1;
    return { isVisible, fade: ownFade * parentFade, wasVisible: wasVisible[i]! };
  });

  function passesVisibilityCheck(instance: VisibilityCullInstance, i: number): boolean {
    const flag = flags[i]!;
    if (flag === HIDDEN_CLOSE_RANGE || flag === HIDDEN) return false;
    if (flag !== NEEDS_CHECK) return true;
    // Godot never reaches the check for an instance out of view, which leaves its state as it was.
    if (!instance.isInView) return false;
    // VIS_RANGE_CHECK passes an instance outside the list (`renderer_scene_cull.cpp:2847`).
    const isInRange = !isListed[i] || rangeAllowsDraw(instance, i);
    const parent = parents[i]!;
    return isInRange && (parent < 0 || parentShowsDependant(flags[parent]!));
  }

  function rangeAllowsDraw(instance: VisibilityCullInstance, i: number): boolean {
    const { check } = checkVisibilityRange(instance.range, instance.distance, wasVisible[i]!);
    wasVisible[i] = drawsAt(check);
    return wasVisible[i]!;
  }
}

const DEPENDENCY_FLAGS: Readonly<Record<RangeCheck, number>> = {
  [RangeCheck.BEYOND_END]: HIDDEN,
  [RangeCheck.SHORT_OF_BEGIN]: HIDDEN_CLOSE_RANGE,
  [RangeCheck.IN_RANGE]: 0,
  [RangeCheck.IN_FADE_MARGIN]: FADE_CHILDREN,
};

function drawsAt(check: RangeCheck): boolean {
  return check === RangeCheck.IN_RANGE || check === RangeCheck.IN_FADE_MARGIN;
}

function fadesItself(range: VisibilityRange): boolean {
  return hasVisibilityRange(range) && range.fadeMode === VisibilityRangeFadeMode.SELF;
}

/** Whether it holds a `visibility_index`: a range, indexed (`renderer_scene_cull.cpp:1457-1459`). */
function isInVisibilityList(instance: VisibilityCullInstance): boolean {
  return instance.isIndexed && hasVisibilityRange(instance.range);
}

/**
 * The parents the cull links: a parent it does not index has no `array_index`, so its dependant
 * takes -1 (`renderer_scene_cull.cpp:1502-1503`).
 */
function indexedParents(instances: readonly VisibilityCullInstance[], parents: readonly number[]): number[] {
  return parents.map((parent) => (parent >= 0 && instances[parent]!.isIndexed ? parent : -1));
}

/**
 * `FLAG_VISIBILITY_DEPENDENCY_NEEDS_CHECK` for an instance the dependency pass does not visit: one
 * with a range or a parent, and outside the list or with no dependants (`renderer_scene_cull.cpp:1496-1500`).
 */
function initialFlags(
  instance: VisibilityCullInstance,
  isListed: boolean,
  parent: number,
  depth: number
): number {
  const hasRange = hasVisibilityRange(instance.range);
  return (hasRange || parent >= 0) && (!isListed || depth === 0) ? NEEDS_CHECK : 0;
}

/** The dependency pass's parent test (`renderer_scene_cull.cpp:2725-2733`). */
function showsDependants(parentFlags: number): boolean {
  return !(parentFlags & HIDDEN) && (parentFlags & (HIDDEN_CLOSE_RANGE | FADE_CHILDREN)) !== 0;
}

/** `_visibility_parent_check` (`renderer_scene_cull.cpp:2799-2805`). */
function parentShowsDependant(parentFlags: number): boolean {
  return (parentFlags & NEEDS_CHECK) === HIDDEN_CLOSE_RANGE || (parentFlags & FADE_CHILDREN) !== 0;
}

/**
 * Each parent link, with a link that would close a cycle dropped. Godot refuses the latest
 * `instance_set_visibility_parent` that closes one (`renderer_scene_cull.cpp:1411-1416`), and the
 * list order stands for the order the links were set.
 */
export function acyclicParents(links: readonly number[]): number[] {
  const parents = links.map(() => -1);
  links.forEach((link, i) => {
    for (let ancestor = link; ancestor >= 0; ancestor = parents[ancestor]!) {
      if (ancestor === i) return;
    }
    parents[i] = link;
  });
  return parents;
}

/** `visibility_dependencies_depth`: 0 with no dependants, else one past the deepest dependant's. */
function dependencyDepths(parents: readonly number[]): number[] {
  const depths = parents.map(() => 0);
  parents.forEach((_, i) => {
    let depth = 0;
    for (let parent = parents[i]!; parent >= 0; parent = parents[parent]!) {
      depth += 1;
      depths[parent] = Math.max(depths[parent]!, depth);
    }
  });
  return depths;
}

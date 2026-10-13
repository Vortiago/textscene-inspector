/**
 * The warning Godot prints when it loads a Real-Time sky whose radiance size is not 256: it bakes
 * the sky at 256 regardless. A rule reaches a sky through the node that holds its environment, so
 * WorldEnvironment and Camera3D each report it through this arm.
 */

import type { RuleArm } from '../../linter/ruleArms.js';
import type { RawScene, TscnInternalResource } from '../../parser/types.js';
import { subResourceRefAnywhere } from '../../godot/index.js';
import { REAL_TIME_RADIANCE_SIZE } from '../../godot/skyReflection.js';
import { findSubResourceOfType } from '../SubResourceResolver.js';
import { decodeSkyProcessing } from './decode.js';

export const REAL_TIME_SKY_SIZE_ARM: RuleArm = {
  severity: 'warning',
  ruleName: 'real-time-sky-radiance-size',
  grounding: { kind: 'engine', at: 'sky.cpp:592' },
};

/** The in-file sub-resource of `type` that `reference` names. A cleared or external slot names none. */
function subResource(
  scene: RawScene,
  reference: string | undefined,
  type: string
): TscnInternalResource | undefined {
  const id = reference === undefined ? null : subResourceRefAnywhere(reference);
  return id === null ? undefined : findSubResourceOfType(scene.internalResources, id, type);
}

/**
 * Why Godot warns about the sky of the environment `environmentRef` names, or null when it does
 * not: the sky is not Real-Time, its size is 256, or the environment or sky is not in this file.
 */
export function realTimeSkySizeProblem(scene: RawScene, environmentRef: string | undefined): string | null {
  const environment = subResource(scene, environmentRef, 'Environment');
  const sky = subResource(scene, environment?.data.sky, 'Sky');
  if (!sky) return null;
  const { processMode, radianceSize } = decodeSkyProcessing(sky.data);
  if (processMode !== 'real-time' || radianceSize === REAL_TIME_RADIANCE_SIZE) return null;
  return (
    `Sky '${sky.id}' is Real-Time with a radiance size of ${radianceSize}. Godot bakes a Real-Time ` +
    `sky at ${REAL_TIME_RADIANCE_SIZE} and prints a warning when it loads.`
  );
}

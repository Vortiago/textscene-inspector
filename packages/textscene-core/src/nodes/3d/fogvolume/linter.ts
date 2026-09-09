/**
 * Semantic rule for FogVolume — `size` is authored while `shape` is World.
 *
 * Advisory: legal Godot, inert consequence, the same shape as `Range`'s
 * `max_value`-below-`min_value` rule.
 *
 * `FogVolume::_validate_property` (fog_volume.cpp:51-54) hides `size` from the
 * inspector once `shape == RS::FOG_VOLUME_SHAPE_WORLD`, but a hand-authored
 * `.tscn` can still carry both keys — the strict scanner reads properties by
 * name, not through the live per-instance property list. When it does, the
 * renderer's own volumetric-fog pass computes `extents` from `size` but only
 * ever CONSUMES it in the branch guarded by
 * `if (volume_type != RS::FOG_VOLUME_SHAPE_WORLD)`
 * (servers/rendering/renderer_rd/environment/fog.cpp:702); the World branch
 * never reads `extents` at all. So an authored `size` alongside `shape = 4` is
 * accepted and stored but never contributes to what is drawn.
 *
 * Format validation (size/shape/material) lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

/** `RS::FogVolumeShape::FOG_VOLUME_SHAPE_WORLD`, fog_volume.cpp:47's 5th enum value. */
const FOG_VOLUME_SHAPE_WORLD = 4;

function checkFogVolumeSize(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const shapeRaw = props.shape;
  const sizeRaw = props.size;
  if (shapeRaw === undefined || sizeRaw === undefined) return [];
  if (ruleInt(shapeRaw) !== FOG_VOLUME_SHAPE_WORLD) return [];

  return [
    {
      severity: 'info',
      message: `FogVolume 'size = ${sizeRaw}' has no effect while 'shape = ${shapeRaw}' (World). A World-shaped FogVolume's extents are never consulted by the volumetric fog pass (fog.cpp:702), and the editor itself hides 'size' for this shape (fog_volume.cpp:52).`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'fogvolume-size-ignored-for-world-shape',
    },
  ];
}

const fogVolumeSizeRule: LintRule = {
  meta: {
    name: 'valid-fogvolume-size',
    description:
      "Flags a FogVolume authoring 'size' while 'shape' is World, where Godot's renderer never consults it",
    category: 'validation',
    applicableNodeTypes: ['FogVolume'],
    emits: [
      {
        ruleName: 'fogvolume-size-ignored-for-world-shape',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'fog.cpp:702',
          unused: 'the world shape never enters the branch that reads the extents',
        },
      },
    ],
  },
  check: checkFogVolumeSize,
};

ruleRegistry.register(fogVolumeSizeRule);

export { fogVolumeSizeRule };

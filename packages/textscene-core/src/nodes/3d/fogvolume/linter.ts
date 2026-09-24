/**
 * Semantic rule for FogVolume: `size` authored while `shape` is World. Advisory, like `Range`'s
 * `max_value`-below-`min_value` rule: legal Godot with an inert consequence. linterParser.ts
 * validates format.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

/** `RS::FogVolumeShape::FOG_VOLUME_SHAPE_WORLD`, fog_volume.cpp:47's 5th enum value. */
const FOG_VOLUME_SHAPE_WORLD = 4;

// `_validate_property` (fog_volume.cpp:51-54) hides `size` for the World shape, but a hand-authored
// `.tscn` can carry both keys, and the strict scanner reads properties by name. The fog pass reads
// `extents` only under `if (volume_type != RS::FOG_VOLUME_SHAPE_WORLD)`
// (servers/rendering/renderer_rd/environment/fog.cpp:702), so such a size is stored, never drawn.
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

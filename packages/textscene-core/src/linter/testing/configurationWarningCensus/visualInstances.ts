/**
 * 3D visual instances: the `GeometryInstance3D` base, CSG shapes and
 * `AnimatedSprite3D`.
 */
import type { WarningRow } from './types.js';

export const visualInstanceWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  AnimatedSprite3D: [
    {
      at: 'sprite_3d.cpp:1472',
      says: 'requires a SpriteFrames resource to display frames',
      verdict: { rule: 'animatedsprite3d-requires-spriteframes' },
    },
  ],

  CSGShape3D: [
    {
      at: 'csg_shape.cpp:982',
      says: 'has an empty (non-manifold) shape',
      verdict: {
        unimplemented:
          'full port needs live CSG geometry; narrower checkable slice: degenerate own geometry — CSGMesh3D with no mesh, CSGPolygon3D polygon under 3 points, zero/negative size/radius/height; reaches the 7 concrete CSG types',
      },
    },
  ],

  GeometryInstance3D: [
    {
      at: 'visual_instance_3d.cpp:513',
      says: "visibility range End is non-zero but lower than Begin, so it's never visible",
      verdict: { rule: 'geometryinstance3d-visibility-range-end-before-begin' },
    },
    {
      at: 'visual_instance_3d.cpp:517',
      says: 'fades in over distance, but the begin fade margin is 0',
      verdict: { rule: 'geometryinstance3d-visibility-range-begin-fade-without-margin' },
    },
    {
      at: 'visual_instance_3d.cpp:521',
      says: 'fades out over distance, but the end fade margin is 0',
      verdict: { rule: 'geometryinstance3d-visibility-range-end-fade-without-margin' },
    },
    {
      at: 'visual_instance_3d.cpp:525',
      says: 'transparency only available with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", visual_instance_3d.cpp:524',
      },
    },
    {
      at: 'visual_instance_3d.cpp:529',
      says: 'visibility-range fade transparency only available with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", visual_instance_3d.cpp:528',
      },
    },
  ],
};

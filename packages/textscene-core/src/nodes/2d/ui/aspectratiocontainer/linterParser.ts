/**
 * AspectRatioContainer strict validators for linting.
 *
 * Declare only AspectRatioContainer's OWN members — the ones doc/classes/AspectRatioContainer.xml
 * lists without an `overrides=` attribute. Everything from Container up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * None of the four setters below (aspect_ratio_container.cpp:48-78) contain an
 * ERR_FAIL or a clamp: each is a bare equality-guarded assignment, so every
 * bound here is a PROPERTY_HINT_RANGE/PROPERTY_HINT_ENUM hint rather than
 * engine enforcement, and every rule is a WARNING (ADR-0032).
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { CONTAINER_ALIGNMENT } from '../../../../linter/validators/containerAlignment.js';
import { v } from '../../../../linter/validators/index.js';

// aspect_ratio_container.cpp:189, PROPERTY_HINT_ENUM "Width Controls
// Height,Height Controls Width,Fit,Cover", matching StretchMode
// STRETCH_WIDTH_CONTROLS_HEIGHT=0 through STRETCH_COVER=3 (aspect_ratio_container.h:44-49).
const STRETCH_MODE = {
  0: 'STRETCH_WIDTH_CONTROLS_HEIGHT',
  1: 'STRETCH_HEIGHT_CONTROLS_WIDTH',
  2: 'STRETCH_FIT',
  3: 'STRETCH_COVER',
};

validatorRegistry.registerAll('AspectRatioContainer', {
  // aspect_ratio_container.cpp:188, PROPERTY_HINT_RANGE "0.001,10.0,0.0001,or_greater".
  // "or_greater" opens the max end (never a diagnostic), so only the 0.001
  // floor is grounded. set_ratio (aspect_ratio_container.cpp:48-54) assigns
  // unconditionally, no ERR_FAIL, so the floor is a warning.
  ratio: v.float('ratio', { min: 0.001, hinted: 'aspect_ratio_container.cpp:188' }),
  // aspect_ratio_container.cpp:189. set_stretch_mode
  // (aspect_ratio_container.cpp:56-62) assigns unconditionally, no ERR_FAIL.
  stretch_mode: v.enumInt('stretch_mode', 0, 3, STRETCH_MODE, {
    hinted: 'aspect_ratio_container.cpp:189',
  }),
  // aspect_ratio_container.cpp:192, PROPERTY_HINT_ENUM "Begin,Center,End",
  // the same AlignmentMode values as BoxContainer's ALIGNMENT_BEGIN=0,
  // ALIGNMENT_CENTER=1, ALIGNMENT_END=2 (aspect_ratio_container.h:50-54).
  // set_alignment_horizontal (aspect_ratio_container.cpp:64-70) assigns
  // unconditionally, no ERR_FAIL.
  alignment_horizontal: v.enumInt('alignment_horizontal', 0, 2, CONTAINER_ALIGNMENT, {
    hinted: 'aspect_ratio_container.cpp:192',
  }),
  // aspect_ratio_container.cpp:193. set_alignment_vertical
  // (aspect_ratio_container.cpp:72-78) assigns unconditionally, no ERR_FAIL.
  alignment_vertical: v.enumInt('alignment_vertical', 0, 2, CONTAINER_ALIGNMENT, {
    hinted: 'aspect_ratio_container.cpp:193',
  }),
});

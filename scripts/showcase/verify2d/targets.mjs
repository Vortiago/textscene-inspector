/**
 * [screenshot-name, fixture file, expectations].
 *
 * `expect` turns a target from a report into a gate. `minControls` guards the
 * failure this exists to catch — a subtree silently disappearing — and
 * `types` names the ones whose absence would otherwise look like a smaller
 * number. `maxFallbacks` defaults to 0 — a TextureRect that cannot resolve its
 * texture draws a dashed placeholder, which for a fixture that DOES declare one
 * means a broken resource scope; raise it only where a fixture deliberately
 * leaves a TextureRect textureless. Console errors are never allowed.
 *
 * Three groups, in the order the gate walks them: the Control overlay itself,
 * the sub-viewport surfaces, and the widgets whose gate is a laid-out box.
 */

import { CONTROL_TARGETS } from './controlTargets.mjs';
import { SURFACE_TARGETS } from './surfaceTargets.mjs';
import { WIDGET_TARGETS } from './widgetTargets.mjs';

export const TARGETS = [...CONTROL_TARGETS, ...SURFACE_TARGETS, ...WIDGET_TARGETS];

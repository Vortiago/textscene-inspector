/**
 * SubViewportContainer registration — strict validators + semantic rules.
 *
 * The first Control slice with lint code. Controls previously had none (they are
 * render-only overlay types, ADR-0003); this one earns it because its
 * correctness depends on its children, which no format validator can see.
 */

import './linterParser.js';
import './linter.js';

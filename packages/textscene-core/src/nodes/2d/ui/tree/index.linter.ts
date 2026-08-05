/**
 * Tree linter registration: strict validators plus the one semantic rule.
 *
 * The rule earns its place because `tile_scroll_hint` is only ever read inside
 * the `scroll_hint_mode != SCROLL_HINT_MODE_DISABLED` draw block, which no
 * single-property validator can see.
 */

import './linterParser.js';
import './linter.js';

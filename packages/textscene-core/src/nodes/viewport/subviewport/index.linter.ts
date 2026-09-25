/**
 * SubViewport strict validators, React-free. No semantic rule: a degenerate size
 * is an engine clamp (viewport.cpp:1120) that `linterParser.ts` reports. Under a
 * `SubViewportContainer`, `render_target_update_mode` and `handle_input_locally`
 * are forced to `ALWAYS` and `false`, but Godot's editor still writes them.
 */

import './linterParser.js';

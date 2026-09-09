/**
 * The four base slices a new leaf can extend, and what each one settles: which
 * parse it reuses, which component, which workspace it belongs to, and the
 * parser test cases its shape implies.
 */

import {
  CONTROL_PARSER_TEST_CASES,
  NODE2D_PARSER_TEST_CASES,
  NODE3D_PARSER_TEST_CASES,
} from './templates/parserTests.mjs';

/** What the viewport does with the type — see the CLI header for what each implies. */
export const INTENTS = ['draws', 'transform-only', 'pending'];

/**
 * `hasLinterParser` drives the side-effect import a generated `linterParser.ts`
 * puts at the top. Without it the module registers only its OWN keys, so a test
 * that imports `./linterParser` directly sees `findValidator` return null for
 * every inherited one — the exact breakage `viewport/subviewport` had to be
 * repaired for by hand. 18 hand-written slices already carry this import.
 */
export const BASES = {
  node3d: {
    workspaceFlag: '',
    dir: 'base/node3d',
    parser: 'parseNode3D',
    component: 'Node3D',
    propsType: 'Node3DProperties',
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    hasLinterParser: true,
    invisibleBase: true,
  },
  node2d: {
    dir: 'base/node2d',
    parser: 'parseNode2D',
    component: 'Node2D',
    propsType: 'Node2DProperties',
    // Node2D world content renders in the 2D canvas only; without this the
    // workspace dispatcher puts it in the 3D viewport (canvasItemRegistry.guard).
    workspaceFlag: 'canvasItem: true,',
    parserTestCases: NODE2D_PARSER_TEST_CASES,
    hasLinterParser: true,
    invisibleBase: true,
  },
  control: {
    workspaceFlag: '',
    dir: '2d/ui/control',
    parser: 'parseControl',
    component: 'Control',
    propsType: 'ControlProperties',
    // Control has no `transform`: layout comes from anchors/offsets, and the
    // whole set is validated on `Control` itself and inherited via the chain.
    // A leaf declares only its OWN members.
    parserTestCases: CONTROL_PARSER_TEST_CASES,
    hasLinterParser: true,
    // The one base a `pending` slice must NOT mount: `Control` lays out anchors
    // and offsets into positioned divs, where the others are invisible groups.
    // Mounting it to fix a badge would be a render change.
    invisibleBase: false,
  },
  node: {
    dir: 'node',
    parser: 'parseNode',
    component: 'Node',
    propsType: 'NodeProperties',
    // Neither 2D nor 3D: passes through both workspaces so its children render
    // wherever they belong.
    workspaceFlag: 'container: true,',
    parserTestCases: NODE3D_PARSER_TEST_CASES,
    // `nodes/node/` registers the ten process/threading/editor keys every type
    // inherits, so a leaf must import it like any other base.
    hasLinterParser: true,
    invisibleBase: true,
  },
};

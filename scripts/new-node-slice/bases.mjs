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

/**
 * What the viewport does with the type, which settles the slice shape, render registration and
 * sheet status together (`sheets.test.mjs`). `draws`: own types, parser and Component, status
 * `unreviewed`. `transform-only` (ADR-0008): the base's parser and component, `linter-only`.
 * `pending`: the base's parser, the base component under `renderIntent: 'pending'`, `unimplemented`.
 */
export const INTENTS = ['draws', 'transform-only', 'pending'];

/**
 * `hasLinterParser` drives the side-effect import at the top of a generated `linterParser.ts`.
 * Without it a test that imports `./linterParser` directly sees `findValidator` return null for
 * every inherited key.
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
    // Control has no `transform`: layout comes from anchors and offsets, validated on `Control`
    // and inherited through the chain. A leaf declares only its own members.
    parserTestCases: CONTROL_PARSER_TEST_CASES,
    hasLinterParser: true,
    // The one base a `pending` slice does not mount: `Control` lays out positioned divs, where the
    // others are invisible groups, so mounting it to fix a badge would change the render.
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

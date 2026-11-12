/**
 * The parser file of each base type, relative to `nodes/`. A slice that registers one of these
 * reads no key of its own. The module imports nothing, so the slice scaffold reads it under plain
 * Node.
 */

/**
 * Base type to parser file, walked beside the NODE_BASE_TYPES validator chain.
 * `propertyGrammarParityScan.test.ts` holds it complete: a missing ancestor is
 * skipped in silence.
 */
export const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Joint3D: 'physics/3d/joint3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  Light2D: '2d/lights/shared/parser.ts',
  VisualInstance3D: '3d/visualinstance3d/parser.ts',
  GeometryInstance3D: '3d/geometryinstance3d/parser.ts',
  // A Button subclass that chains through `parseButton` reads `text`, `flat`,
  // `alignment` and the icon trio. Without this hop each looks linter-only.
  Button: '2d/ui/button/parser.ts',
  Control: '2d/ui/control/parser.ts',
  // ParallaxBackground is a CanvasLayer, not a Node2D, so `visible` and `layer`
  // reach it through this parser and nothing else.
  CanvasLayer: '2d/ui/canvaslayer/parser.ts',
  Node: 'node/parser.ts',
  // The container and mesh hops, measured by walking NODE_BASE_TYPES for every
  // slice that reuses a base parser.
  VBoxContainer: '2d/ui/vboxcontainer/parser.ts',
  HBoxContainer: '2d/ui/hboxcontainer/parser.ts',
  PanelContainer: '2d/ui/panelcontainer/parser.ts',
  MeshInstance3D: '3d/meshinstance3d/parser.ts',
  // Two family parsers in `shared/`, so the subpath is a module, not a slice. A
  // Range subclass reads the keys `parseRange` models, and a Slider subclass
  // more through `parseSlider`.
  Range: '2d/ui/shared/range.ts',
  Slider: '2d/ui/shared/slider.ts',
  // Both bases are real scene types with a parser of their own, and each is
  // also the hop their H/V subclasses inherit `vertical` and the family's own
  // keys through.
  BoxContainer: '2d/ui/boxcontainer/parser.ts',
  SplitContainer: '2d/ui/splitcontainer/parser.ts',
  // CodeEdit inherits the whole TextEdit surface, and GraphNode and GraphFrame
  // the whole GraphElement one.
  TextEdit: '2d/ui/textedit/parser.ts',
  GraphElement: '2d/ui/graphelement/parser.ts',
  // Every modifier reads `active` and `influence`, and a constraint reads the base `settings/<i>/` leaves.
  SkeletonModifier3D: '3d/skeleton/skeletonmodifier3d/parser.ts',
  BoneConstraint3D: '3d/skeleton/boneconstraint3d/parser.ts',
  // The H and V flow containers and the enabler register the parse of this base.
  FlowContainer: '2d/ui/flowcontainer/parser.ts',
  VisibleOnScreenNotifier3D: '3d/visibleonscreennotifier3d/parser.ts',
};

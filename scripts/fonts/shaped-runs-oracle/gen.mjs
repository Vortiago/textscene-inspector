// Runs oracle.gd for each case and writes the glyphs Godot 4.6.3's shaper gives each text: glyph index, cluster,
// advance and offset. Run it with Godot 4.6.3 on the path.
// Usage: node gen.mjs <repository root> <out path>
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGodotOracle } from '../godot-oracle/godotOracle.mjs';

const [root, out] = process.argv.slice(2);
const FIXTURES = join(root, 'scenes/fixtures/fonts');
const WGHT = 2003265652;
// Typed base and marks: Godot composes a pair the font has a character for, and else places the marks.
const TYPED_MARKS = [
  'A\u0308',
  'a\u0308',
  'A\u0323\u0308',
  'A\u0308\u0323',
  'e\u0301x',
  'o\u0302\u0301',
  'a\u0308\u0308',
  'x\u0301',
  'na\u0308n',
];
const CASES = [
  {
    font: join(FIXTURES, 'montserrat-semibold-marks-subset.ttf'),
    texts: TYPED_MARKS,
    sizes: '16,32',
    opentype: {},
  },
  {
    font: join(FIXTURES, 'montserrat-semibold-marks-nogpos-subset.ttf'),
    texts: TYPED_MARKS,
    sizes: '16,32',
    opentype: {},
  },
  {
    font: join(FIXTURES, 'montserrat-semibold-subset.ttf'),
    texts: ['fi', 'office', 'fly', 'ffi'],
    sizes: '16,32',
    opentype: {},
  },
  // `liga` lookups that skip marks, and a multiple substitution (scripts/fonts/lookup-flags).
  {
    font: join(FIXTURES, 'montserrat-lookup-flags.ttf'),
    texts: ['fi', 'f\u0301i', 'f\u0301\u0323i', 'an', 'a\u0308n', 'a\u0308x', 'x', 'axa', 'x\u0301', 'fix'],
    sizes: '16,32',
    opentype: {},
  },
  // Godot's default theme font: `ff`, `fi`, `fl`, `ffi` and `ffl` are ligatures.
  {
    font: join(root, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2'),
    texts: [
      'fi',
      'fl',
      'ff',
      'ffi',
      'ffl',
      'office',
      'afflict',
      'Tffi.',
      'fifi',
      'ft',
      'fj',
      'Th',
      'A\u0308',
      'a\u0308\u0301',
    ],
    sizes: '12,16,24,32',
    opentype: {},
  },
  // The Label3D text of the 3D goldens, in Godot's default font at Label3D's default size of 32 (label_3d.h).
  {
    font: join(root, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2'),
    texts: [
      'Advanced PBR',
      'Ambient Occlusion Comparison',
      'ArrayMesh UV orientation',
      'ArrayMesh surface material: ExtResource vs own SubResource',
      'ArrayMesh surface_material_override/1',
      'Basic Materials (albedo, metallic, roughness)',
      'Both plates must be the same blue; a white RIGHT plate is the regression',
      'Box with external albedo, normal, metallic, roughness textures',
      'Box with gold surface_material_override/0',
      'BoxMesh Test',
      'BoxMesh with custom size (1.5x2x1) and subdivisions',
      'Camera3D Basic Test',
      'CapsuleMesh Test',
      'CapsuleMesh with radius=0.5, height=3.0, blue metallic',
      'CylinderMesh Test',
      'CylinderMesh with radius=0.5, height=2.0, green material',
      'Decal cull_mask vs layers',
      'Default material (gray)',
      'Emission & Normal Maps',
      'External ArrayMesh: surface materials vs material_override',
      'External Texture Test',
      'Green band on TOP, red on BOTTOM (Godot V origin = image top)',
      'LEFT hard edges. RIGHT soft. One shared image.',
      'LEFT layers=2, culled: bare. RIGHT default: checkered',
      'Left plate blue from the mesh, right plate amber from the override',
      'Left plates blue; BOTH right plates orange',
      'MainCamera (perspective, FOV=75 degrees)',
      'Material Feature Showcase',
      'Material Override Test',
      'Metallic Material Test',
      'Multi-Camera Test',
      'Normal Map Comparison',
      'OrthoCamera (orthographic projection)',
      'Plane Rotation+Scale Edge Case',
      'PlaneMesh 10x10 floor with subdivisions, orientation=Y',
      'PlaneMesh Test',
      'PrismMesh Test',
      'PrismMesh with size=(2,3,2), purple material',
      'Red test box',
      'Reference wall (simple scale)',
      'Rotated and scaled wall (complex transform)',
      'Scene ArrayMesh: surface materials vs material_override',
      'SideCamera (from side, FOV=70 degrees)',
      'Single Camera3D at position (5,5,5), FOV=75 degrees',
      'Sphere with metallic=1.0, roughness=0.1 (shiny metal)',
      'Surface Material Override',
      'TopCamera (looking down, FOV=60 degrees)',
      'TorusMesh Test',
      'TorusMesh with inner=0.5, outer=1.5, orange metallic',
      'Transparency & Glass',
      'With Normal Map',
      'Without Normal Map',
      'ao_enabled=false',
      'ao_enabled=true (checkerboard AO map)',
      'material_override (red)',
      'texture_filter: NEAREST vs LINEAR',
    ],
    sizes: '32',
    opentype: {},
  },
  // The default-font Label3D of the scene-font golden, at its font_size 128.
  {
    font: join(root, 'packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2'),
    texts: ['Hog Wave'],
    sizes: '128',
    opentype: {},
  },
  // A contextual `rvrn` rule from wght 650: `a` before `b`, and `l` after `i` (scripts/fonts/contextual-rvrn).
  ...[{}, { [WGHT]: 600 }, { [WGHT]: 700 }, { [WGHT]: 1000 }].map((opentype) => ({
    font: join(FIXTURES, 'recursive-contextual-rvrn.woff2'),
    texts: ['ab', 'ba', 'abab', 'il', 'li', 'ilb', 'aab', 'a b'],
    sizes: '16,32',
    opentype,
  })),
];

const ORACLE = join(dirname(fileURLToPath(import.meta.url)), 'oracle.gd');

const rows = CASES.flatMap(({ font, texts, sizes, opentype }) =>
  runGodotOracle(ORACLE, [font, JSON.stringify(texts), sizes, JSON.stringify(opentype)]).map((row) => ({
    font: font.split('/').pop(),
    ...row,
  }))
);
writeFileSync(out, `${JSON.stringify(rows, null, 1)}\n`);

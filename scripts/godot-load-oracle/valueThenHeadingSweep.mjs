import { writeCaseFiles } from './writeCaseFiles.mjs';

/** A value of each kind the tokenizer ends differently, written before a heading on its line. */
const VALUES = {
  int: '1',
  float: '-1.5e3',
  string: '"a [b]"',
  bool: 'true',
  constructor: 'Vector2(1, 2)',
  array: '[1, [2]]',
  typed_array: 'Array[int]([1])',
  dictionary: '{ "a": [1] }',
  string_name: '&"x"',
  node_path: '^"x"',
  color: 'Color(1, 0, 0, 1)',
};

/** The text between the value and the heading's `[`. */
const GAPS = { space: ' ', none: '' };

const HEADING = '[node name="B" type="Node2D" parent="."]';

/** A scene whose node A holds `property`, written over one or more lines. */
const scene = (...property) =>
  [
    '[gd_scene format=3]',
    '',
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    ...property,
    'position = Vector2(5, 5)',
    '',
  ].join('\n');

const cases = [
  ...Object.entries(VALUES).flatMap(([kind, value]) =>
    Object.entries(GAPS).map(([gap, text]) => ({
      file: `${kind}__${gap}.tscn`,
      text: scene(`editor_description = ${value}${text}${HEADING}`),
    }))
  ),
  { file: 'next_line.tscn', text: scene('editor_description =', `"a" ${HEADING}`) },
  { file: 'split.tscn', text: scene('editor_description = ["a",', `"b"] ${HEADING}`) },
];
console.log(writeCaseFiles(process.argv[2], cases));

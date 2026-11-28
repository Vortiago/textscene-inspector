import { writeCaseFiles } from './writeCaseFiles.mjs';

const sceneHead = '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n';
const childBody = '\nposition = Vector2(5, 5)\n';
const refusedHeading = '\n[node name="Z" parent="." type=]\n';
const codes = { nul: '\0', tab: '\t', soh: '\x01', cr: '\r' };
// Each place in a child heading, with `@` where the control code goes.
const places = {
  before_open: '@[node name="A" type="Node2D" parent="."]',
  after_open: '[@node name="A" type="Node2D" parent="."]',
  inside_name: '[no@de name="A" type="Node2D" parent="."]',
  after_name: '[node@ name="A" type="Node2D" parent="."]',
  before_equals: '[node name@="A" type="Node2D" parent="."]',
  after_equals: '[node name=@"A" type="Node2D" parent="."]',
  inside_value: '[node name="A@" type="Node2D" parent="."]',
  after_value: '[node name="A"@ type="Node2D" parent="."]',
  before_close: '[node name="A" type="Node2D" parent="."@]',
  after_close: '[node name="A" type="Node2D" parent="."]@',
};
const cases = Object.entries(codes).flatMap(([codeName, code]) =>
  Object.entries(places).flatMap(([placeName, heading]) => {
    const scene = sceneHead + heading.replace('@', code) + childBody;
    // The tree shows whether the heading opens `A`, and the refused heading after it shows Godot's line.
    return [
      { file: `${codeName}_${placeName}_tree.tscn`, text: scene },
      { file: `${codeName}_${placeName}_line.tscn`, text: scene + refusedHeading },
    ];
  })
);
console.log(writeCaseFiles(process.argv[2], cases));

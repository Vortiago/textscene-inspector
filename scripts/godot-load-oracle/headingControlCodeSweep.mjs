import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('expected a folder to write the cases to, got no argument');
// The cases go into a new or empty folder, so no file of the caller's is overwritten.
if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`expected an empty folder, got ${out}`);
mkdirSync(out, { recursive: true });
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
let count = 0;
for (const [codeName, code] of Object.entries(codes)) {
  for (const [placeName, heading] of Object.entries(places)) {
    const scene = sceneHead + heading.replace('@', code) + childBody;
    // The tree shows whether the heading opens `A`, and the refused heading after it shows Godot's line.
    writeFileSync(`${out}/${codeName}_${placeName}_tree.tscn`, scene);
    writeFileSync(`${out}/${codeName}_${placeName}_line.tscn`, scene + refusedHeading);
    count += 2;
  }
}
console.log(count);

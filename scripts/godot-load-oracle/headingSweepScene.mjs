/** The scene's heading kinds, each with `@<kind>` where the sweep writes its field. */
const SCENE_HEADINGS = ['gd_scene', 'ext_resource', 'sub_resource', 'node', 'connection', 'editable'];

const SCENE_LINES = [
  '[gd_scene format=3@gd_scene]',
  '',
  '@ext_1',
  '',
  '[ext_resource type="Resource" path="res://real.tres" id="2"@ext_resource]',
  '',
  '[sub_resource type="Resource" id="s"]',
  '',
  '[sub_resource type="Resource" id="t"@sub_resource]',
  '',
  '[node name="Root" type="Node2D"]',
  '',
  '[node name="A" type="Node2D" parent="."@node]',
  'position = Vector2(5, 5)',
  '',
  '[node name="C" type="Node2D" parent="."]',
  'position = Vector2(1, 1)',
  '',
  '[connection signal="ready" from="." to="." method="get_class"@connection]',
  '',
  '[editable path="A"@editable]',
  '',
  '[editable path="C"]',
  '',
];

// Godot prints an error for a missing file nothing reads, so only a field that reads it gets the heading.
const MISSING_EXT = '[ext_resource type="Resource" path="res://gone_ext.tres" id="1"]';

/** The file every scene's second `[ext_resource]` heading names, so that heading loads. */
export const REAL_RESOURCE = {
  name: 'real',
  extension: 'tres',
  text: '[gd_resource type="Resource" format=3]\n\n[resource]\n',
};

const RESOURCE_TEXT = '[gd_resource type="Resource" format=3@gd_resource]\n\n[resource]\n';

/** The file of a heading kind with ` <field>` in that heading: its extension and its text. */
export function fileWithField(kind, field) {
  if (kind === 'gd_resource')
    return { extension: 'tres', text: RESOURCE_TEXT.replace('@gd_resource', ` ${field}`) };
  const text = SCENE_LINES.join('\n')
    .replace('@ext_1', field.includes('ExtResource') ? MISSING_EXT : '; no ext_resource 1')
    .replace(`@${kind}`, ` ${field}`)
    .replace(/@[a-z_]+/g, '');
  return { extension: 'tscn', text };
}

export const HEADING_KINDS = ['gd_resource', ...SCENE_HEADINGS];

/** Writes each case into a new or empty folder, so no file of the caller's is overwritten. */
export async function writeCases(out, cases) {
  const { existsSync, mkdirSync, readdirSync, writeFileSync } = await import('node:fs');
  if (!out) throw new Error('expected a folder to write the cases to, got no argument');
  if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`expected an empty folder, got ${out}`);
  mkdirSync(out, { recursive: true });
  for (const { name, extension, text } of [REAL_RESOURCE, ...cases])
    writeFileSync(`${out}/${name}.${extension}`, text);
  console.log(cases.length + 1);
}

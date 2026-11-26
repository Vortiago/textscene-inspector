import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2];
if (!out) throw new Error('expected a folder to write the cases to, got no argument');
// The cases go into a new or empty folder, so no file of the caller's is overwritten.
if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`expected an empty folder, got ${out}`);
mkdirSync(out, { recursive: true });
const sceneHead = '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n';
const childNode = '\n[node name="A" type="Node2D" parent="."]\n';
const refusedHeading = '\n[node name="Z" parent="." type=]\n';
const backslash = '\\';
const cases = {
  // line endings
  e1_crlf: (sceneHead + 'position = Vector2(5, 5)\n' + refusedHeading).replace(/\n/g, '\r\n'),
  e2_lone_cr: (sceneHead + 'position = Vector2(5, 5)\n' + refusedHeading).replace(/\n/g, '\r'),
  e3_no_final_newline: sceneHead + 'position = Vector2(5, 5)\n\n[node name="Z" parent="." type=]',
  e4_no_final_newline_loads: sceneHead + 'position = Vector2(5, 5)',
  e5_crlf_in_string: sceneHead + 'editor_description = "a\r\nb"\r\n' + refusedHeading,
  e6_lone_cr_in_string: sceneHead + 'editor_description = "a\rb"\n' + refusedHeading,
  // string escapes
  s1_escape_n: sceneHead + 'editor_description = "a' + backslash + 'nb"\n' + refusedHeading,
  s2_real_newline: sceneHead + 'editor_description = "a\nb"\n' + refusedHeading,
  s3_two_backslashes_newline:
    sceneHead + 'editor_description = "a' + backslash + backslash + '\nb"\n' + refusedHeading,
  s4_three_backslashes_newline:
    sceneHead + 'editor_description = "a' + backslash + backslash + backslash + '\nb"\n' + refusedHeading,
  s5_backslash_tab_newline: sceneHead + 'editor_description = "a' + backslash + '\t\nb"\n' + refusedHeading,
  s6_backslash_eof: sceneHead + 'editor_description = "a' + backslash,
  s7_stringname_escaped_newline: sceneHead + 'metadata/a = &"a' + backslash + '\nb"\n' + refusedHeading,
  s8_nodepath_escaped_newline: sceneHead + 'metadata/a = ^"a' + backslash + '\nb"\n' + refusedHeading,
  s9_two_escaped_newlines:
    sceneHead + 'editor_description = "a' + backslash + '\nb' + backslash + '\nc"\n' + refusedHeading,
  s10_escaped_newline_in_array: sceneHead + 'metadata/a = ["a' + backslash + '\nb", 1]\n' + refusedHeading,
  s11_heading_field_escaped_crlf: (
    sceneHead +
    '\n[node name="A' +
    backslash +
    '\nB" type="Node2D" parent="."]\n' +
    refusedHeading
  ).replace(/\n/g, '\r\n'),
  s12_escaped_newline_then_read:
    sceneHead + 'metadata/a = ["a' + backslash + '\nb", Resource("res://missing.tres")]\n',
  s13_real_newline_then_read: sceneHead + 'metadata/a = ["a\nb", Resource("res://missing.tres")]\n',
  // key and value split
  k1_eq_next_line: sceneHead + 'position\n= Vector2(5, 5)\n',
  k2_value_next_line: sceneHead + 'position =\nVector2(5, 5)\n',
  k3_split_after_paren: sceneHead + 'position = Vector2(\n5, 5)\n',
  k4_split_after_comma: sceneHead + 'position = Vector2(5,\n5)\n',
  k5_comment_after_eq: sceneHead + 'position = ; c\nVector2(5, 5)\n',
  k6_comment_before_eq: sceneHead + 'position ; c\n= Vector2(5, 5)\n',
  k7_array_split: sceneHead + 'metadata/a = [\n1,\n2]\n' + refusedHeading,
  k8_blank_line_before_value: sceneHead + 'position =\n\nVector2(5, 5)\n',
  k9_value_next_line_probe: sceneHead + 'position =\nVector2(5, 5)\n' + refusedHeading,
  k10_comment_in_array: sceneHead + 'metadata/a = [1, ; c\n2]\n' + refusedHeading,
  k11_key_alone_then_heading: sceneHead + 'position\n' + childNode,
  k12_eq_alone_then_heading: sceneHead + 'position =\n' + childNode,
  k13_value_split_then_read: sceneHead + 'metadata/a = [\n1,\nResource("res://missing.tres")]\n',
  k14_dict_split: sceneHead + 'metadata/a = {\n"k":\n1}\n' + refusedHeading,
  // heading refused at each token, a section open before it
  h1_bracket_then_newline:
    sceneHead + 'position = Vector2(5, 5)\n\n[\nnode name="B" parent="." type="Node2D"]\n',
  h2_name_then_newline_refused: sceneHead + 'position = Vector2(5, 5)\n\n[node\nname="B" parent="." type=]\n',
  h3_key_then_newline: sceneHead + 'position = Vector2(5, 5)\n\n[node name\n="B" parent="." type="Node2D"]\n',
  h4_stray_eq: sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent="." = ]\n',
  h5_missing_eq: sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent "."]\n',
  h6_empty_value: sceneHead + 'position = Vector2(5, 5)\n\n[node name=]\n',
  h7_number_token: sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent="." type="Node2D" 5]\n',
  h8_empty_tag: sceneHead + 'position = Vector2(5, 5)\n\n[]\n',
  h9_eof_in_tag: sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent="."',
  h10_eof_after_number: sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent="." x=1',
  h11_refused_then_body:
    sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" parent="." type=]\nposition = Vector2(7, 7)\n',
  h12_refused_multiline_then_body:
    sceneHead + 'position = Vector2(5, 5)\n\n[node name="B"\nparent="." type=]\nposition = Vector2(7, 7)\n',
  h13_refused_after_crlf: (
    sceneHead + 'position = Vector2(5, 5)\n\n[node name="B"\nparent="." = ]\n'
  ).replace(/\n/g, '\r\n'),
  h14_comment_in_heading_refused:
    sceneHead + 'position = Vector2(5, 5)\n\n[node name="B" ; c\nparent="." type=]\n',
  h15_unclosed_string_in_heading:
    sceneHead + 'position = Vector2(5, 5)\n\n[node name="B parent="." type="Node2D"]\n',
  // misplaced heading followed by each
  m1_misplaced_then_body_next_line:
    sceneHead + '\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\nx = ExtResource("1")\n',
  m2_misplaced_then_refused:
    sceneHead +
    '\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\n\n[node name="B" parent="." type=]\n',
  m3_misplaced_multiline: sceneHead + '\n[ext_resource type="Resource"\npath="res://gone.tres" id="1"]\n',
  m4_misplaced_escaped_newline:
    sceneHead + '\n[ext_resource type="Resource" path="res://gone.tres" id="a' + backslash + '\nb"]\n',
  m5_misplaced_crlf: (
    sceneHead + '\n[ext_resource type="Resource"\npath="res://gone.tres" id="1"]\n'
  ).replace(/\n/g, '\r\n'),
  m6_misplaced_then_value_next_line:
    sceneHead + '\n[ext_resource type="Resource" path="res://gone.tres" id="1"] x =\nExtResource("1")\n',
  m7_misplaced_after_escaped_body:
    sceneHead +
    'editor_description = "a' +
    backslash +
    '\nb"\n\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\n',
};
for (const [name, text] of Object.entries(cases)) writeFileSync(`${out}/${name}.tscn`, text);
console.log(Object.keys(cases).length);

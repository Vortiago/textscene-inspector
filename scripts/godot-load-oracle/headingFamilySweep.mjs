import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
const out = process.argv[2];
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const H = '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n';
const A = '\n[node name="A" type="Node2D" parent="."]\n';
const PROBE = '\n[node name="Z" parent="." type=]\n';
const BS = '\\';
const cases = {
  // line endings
  e1_crlf: (H + 'position = Vector2(5, 5)\n' + PROBE).replace(/\n/g, '\r\n'),
  e2_lone_cr: (H + 'position = Vector2(5, 5)\n' + PROBE).replace(/\n/g, '\r'),
  e3_no_final_newline: H + 'position = Vector2(5, 5)\n\n[node name="Z" parent="." type=]',
  e4_no_final_newline_loads: H + 'position = Vector2(5, 5)',
  e5_crlf_in_string: H + 'editor_description = "a\r\nb"\r\n' + PROBE,
  e6_lone_cr_in_string: H + 'editor_description = "a\rb"\n' + PROBE,
  // string escapes
  s1_escape_n: H + 'editor_description = "a' + BS + 'nb"\n' + PROBE,
  s2_real_newline: H + 'editor_description = "a\nb"\n' + PROBE,
  s3_two_backslashes_newline: H + 'editor_description = "a' + BS + BS + '\nb"\n' + PROBE,
  s4_three_backslashes_newline: H + 'editor_description = "a' + BS + BS + BS + '\nb"\n' + PROBE,
  s5_backslash_tab_newline: H + 'editor_description = "a' + BS + '\t\nb"\n' + PROBE,
  s6_backslash_eof: H + 'editor_description = "a' + BS,
  s7_stringname_escaped_newline: H + 'metadata/a = &"a' + BS + '\nb"\n' + PROBE,
  s8_nodepath_escaped_newline: H + 'metadata/a = ^"a' + BS + '\nb"\n' + PROBE,
  s9_two_escaped_newlines: H + 'editor_description = "a' + BS + '\nb' + BS + '\nc"\n' + PROBE,
  s10_escaped_newline_in_array: H + 'metadata/a = ["a' + BS + '\nb", 1]\n' + PROBE,
  s11_heading_field_escaped_crlf: (
    H +
    '\n[node name="A' +
    BS +
    '\nB" type="Node2D" parent="."]\n' +
    PROBE
  ).replace(/\n/g, '\r\n'),
  s12_escaped_newline_then_read: H + 'metadata/a = ["a' + BS + '\nb", Resource("res://missing.tres")]\n',
  s13_real_newline_then_read: H + 'metadata/a = ["a\nb", Resource("res://missing.tres")]\n',
  // key and value split
  k1_eq_next_line: H + 'position\n= Vector2(5, 5)\n',
  k2_value_next_line: H + 'position =\nVector2(5, 5)\n',
  k3_split_after_paren: H + 'position = Vector2(\n5, 5)\n',
  k4_split_after_comma: H + 'position = Vector2(5,\n5)\n',
  k5_comment_after_eq: H + 'position = ; c\nVector2(5, 5)\n',
  k6_comment_before_eq: H + 'position ; c\n= Vector2(5, 5)\n',
  k7_array_split: H + 'metadata/a = [\n1,\n2]\n' + PROBE,
  k8_blank_line_before_value: H + 'position =\n\nVector2(5, 5)\n',
  k9_value_next_line_probe: H + 'position =\nVector2(5, 5)\n' + PROBE,
  k10_comment_in_array: H + 'metadata/a = [1, ; c\n2]\n' + PROBE,
  k11_key_alone_then_heading: H + 'position\n' + A,
  k12_eq_alone_then_heading: H + 'position =\n' + A,
  k13_value_split_then_read: H + 'metadata/a = [\n1,\nResource("res://missing.tres")]\n',
  k14_dict_split: H + 'metadata/a = {\n"k":\n1}\n' + PROBE,
  // heading refused at each token, a section open before it
  h1_bracket_then_newline: H + 'position = Vector2(5, 5)\n\n[\nnode name="B" parent="." type="Node2D"]\n',
  h2_name_then_newline_refused: H + 'position = Vector2(5, 5)\n\n[node\nname="B" parent="." type=]\n',
  h3_key_then_newline: H + 'position = Vector2(5, 5)\n\n[node name\n="B" parent="." type="Node2D"]\n',
  h4_stray_eq: H + 'position = Vector2(5, 5)\n\n[node name="B" parent="." = ]\n',
  h5_missing_eq: H + 'position = Vector2(5, 5)\n\n[node name="B" parent "."]\n',
  h6_empty_value: H + 'position = Vector2(5, 5)\n\n[node name=]\n',
  h7_number_token: H + 'position = Vector2(5, 5)\n\n[node name="B" parent="." type="Node2D" 5]\n',
  h8_empty_tag: H + 'position = Vector2(5, 5)\n\n[]\n',
  h9_eof_in_tag: H + 'position = Vector2(5, 5)\n\n[node name="B" parent="."',
  h10_eof_after_number: H + 'position = Vector2(5, 5)\n\n[node name="B" parent="." x=1',
  h11_refused_then_body:
    H + 'position = Vector2(5, 5)\n\n[node name="B" parent="." type=]\nposition = Vector2(7, 7)\n',
  h12_refused_multiline_then_body:
    H + 'position = Vector2(5, 5)\n\n[node name="B"\nparent="." type=]\nposition = Vector2(7, 7)\n',
  h13_refused_after_crlf: (H + 'position = Vector2(5, 5)\n\n[node name="B"\nparent="." = ]\n').replace(
    /\n/g,
    '\r\n'
  ),
  h14_comment_in_heading_refused: H + 'position = Vector2(5, 5)\n\n[node name="B" ; c\nparent="." type=]\n',
  h15_unclosed_string_in_heading: H + 'position = Vector2(5, 5)\n\n[node name="B parent="." type="Node2D"]\n',
  // misplaced heading followed by each
  m1_misplaced_then_body_next_line:
    H + '\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\nx = ExtResource("1")\n',
  m2_misplaced_then_refused:
    H +
    '\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\n\n[node name="B" parent="." type=]\n',
  m3_misplaced_multiline: H + '\n[ext_resource type="Resource"\npath="res://gone.tres" id="1"]\n',
  m4_misplaced_escaped_newline:
    H + '\n[ext_resource type="Resource" path="res://gone.tres" id="a' + BS + '\nb"]\n',
  m5_misplaced_crlf: (H + '\n[ext_resource type="Resource"\npath="res://gone.tres" id="1"]\n').replace(
    /\n/g,
    '\r\n'
  ),
  m6_misplaced_then_value_next_line:
    H + '\n[ext_resource type="Resource" path="res://gone.tres" id="1"] x =\nExtResource("1")\n',
  m7_misplaced_after_escaped_body:
    H +
    'editor_description = "a' +
    BS +
    '\nb"\n\n[ext_resource type="Resource" path="res://gone.tres" id="1"]\n',
};
for (const [name, text] of Object.entries(cases)) writeFileSync(`${out}/${name}.tscn`, text);
console.log(Object.keys(cases).length);

/**
 * The dead-ButtonGroup rule.
 *
 * The load-bearing case is the per-subclass default: an absent `toggle_mode`
 * means true on the five subclasses whose constructor sets it, and false
 * everywhere else.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('valid-button-group', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  /** The dead-group diagnostics a scene produces. */
  const groupWarnings = (content: string) =>
    linter.lint(content).filter((d) => d.ruleName === 'button-group-without-toggle-mode');

  const scene = (type: string, props: string) => `[gd_scene load_steps=2 format=3]

[sub_resource type="ButtonGroup" id="ButtonGroup_1"]

[node name="Root" type="Control"]

[node name="B" type="${type}" parent="."]
${props}
`;

  it('warns on a grouped Button that is not a toggle', () => {
    const found = groupWarnings(scene('Button', 'button_group = SubResource("ButtonGroup_1")'));
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
  });

  it('stays silent once that Button opts into toggle_mode', () => {
    expect(
      groupWarnings(
        scene('Button', 'button_group = SubResource("ButtonGroup_1")\ntoggle_mode = true')
      )
    ).toEqual([]);
  });

  it('stays silent on a grouped CheckBox with no toggle_mode key', () => {
    // check_box.cpp:172 sets it in the constructor, so Godot omits it when
    // serialising. Reading absence as false would warn on every grouped
    // CheckBox in existence.
    expect(
      groupWarnings(scene('CheckBox', 'button_group = SubResource("ButtonGroup_1")'))
    ).toEqual([]);
  });

  it.each(['CheckButton', 'ColorPickerButton', 'MenuButton', 'OptionButton'])(
    'stays silent on a grouped %s with no toggle_mode key',
    (type) => {
      expect(groupWarnings(scene(type, 'button_group = SubResource("ButtonGroup_1")'))).toEqual(
        []
      );
    }
  );

  it('warns when one of those subclasses explicitly turns toggle_mode off', () => {
    expect(
      groupWarnings(
        scene('CheckBox', 'button_group = SubResource("ButtonGroup_1")\ntoggle_mode = false')
      )
    ).toHaveLength(1);
  });

  it('stays silent when there is no group at all', () => {
    expect(groupWarnings(scene('Button', 'text = "Plain"'))).toEqual([]);
  });

  it('stays silent on a node that is not a button', () => {
    expect(groupWarnings(scene('Label', 'text = "Not a button"'))).toEqual([]);
  });

  it('reaches a subclass through the base chain rather than an exact type list', () => {
    // LinkButton defaults toggle_mode to false and declares nothing itself.
    expect(
      groupWarnings(scene('LinkButton', 'button_group = SubResource("ButtonGroup_1")'))
    ).toHaveLength(1);
  });
});

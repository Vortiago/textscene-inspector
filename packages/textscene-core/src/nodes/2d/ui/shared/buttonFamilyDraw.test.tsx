/**
 * What `Button::_notification` draws holds for every Button subclass. A focused button draws the `focus`
 * box over the chrome (`button.cpp:220-222`), and `font_focus_color` and `icon_focus_color` in the normal
 * draw mode only (`button.cpp:280-292`). The theme icon `icon` stands in for a missing one
 * (`button.cpp:224-227`). A subclass draws its own element over the label.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import type * as THREE from 'three';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import {
  findIconMeshes,
  findTextMesh,
  OWN_ICON_REF,
  OWN_ICON_SCOPE,
  renderWithOwnIcon,
} from '../../../../r3f/controls/native/testing/ownIcon';
import { bundledRunOf } from '../../../../r3f/controls/native/testing/bundledRunStub';
import { Button } from '../button/Component';
import { CheckBox } from '../checkbox/Component';
import { CheckButton } from '../checkbutton/Component';
import { MenuButton } from '../menubutton/Component';
import { OptionButton } from '../optionbutton/Component';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 40 };
const ICON_SIZE = { x: 12, y: 12 };
const RED: Rgba = { r: 1, g: 0, b: 0, a: 1 };
const GREEN: Rgba = { r: 0, g: 1, b: 0, a: 1 };

interface FamilyCase {
  name: string;
  Component: ComponentType<NativeControlComponentProps>;
  /** The properties that give the button a label and Button's own icon. */
  shown: Record<string, unknown>;
}

const TEXT_AND_ICON = { text: 'Go', icon: OWN_ICON_REF };

const FAMILY: FamilyCase[] = [
  { name: 'Button', Component: Button, shown: TEXT_AND_ICON },
  { name: 'MenuButton', Component: MenuButton, shown: TEXT_AND_ICON },
  { name: 'CheckBox', Component: CheckBox, shown: TEXT_AND_ICON },
  { name: 'CheckButton', Component: CheckButton, shown: TEXT_AND_ICON },
  {
    name: 'OptionButton',
    Component: OptionButton,
    shown: { items: [{ text: 'Go', id: 0, icon: OWN_ICON_REF }], selected: 0 },
  },
];

/** `fields` stand in for what the tree build gives the node before the default theme fills it. */
function familyNode(c: FamilyCase, properties: Record<string, unknown>, fields: Partial<SolveNode>) {
  return withThemeItems({
    ...emptySolveNode(),
    path: 'N',
    node: controlNode('N', c.name, { name: 'N', ...c.shown, ...properties }),
    resources: OWN_ICON_SCOPE,
    textureSize: ICON_SIZE,
    textureSlots: { icon: ICON_SIZE },
    ...fields,
  } satisfies SolveNode);
}

async function drawn(c: FamilyCase, properties: Record<string, unknown>, colors: SolveNode['colors'] = {}) {
  const { Component } = c;
  const rendered = await renderWithOwnIcon(
    <Component
      {...painterEnv()}
      solveNode={familyNode(c, properties, { colors })}
      rect={RECT}
      renderOrder={0}
    />,
    { w: ICON_SIZE.x, h: ICON_SIZE.y }
  );
  const icons = findIconMeshes(rendered.scene);
  const text = findTextMesh(rendered.scene)!;
  return {
    textColor: bundledRunOf(text)!.tint,
    ownIconColor: (icons[0]!.material as THREE.MeshBasicMaterial).color,
    meshCount: rendered.scene.findAllByType('Mesh').length,
  };
}

describe.each(FAMILY)('a focused <$name> (button.cpp:220-222,280-292)', (c) => {
  it('draws its label in font_focus_color, 0.95 grey by default (default_theme.cpp:159)', async () => {
    const { textColor } = await drawn(c, { hasFocus: true });
    expect(textColor.r).toBeCloseTo(0.95, 5);
  });

  it('draws its label in a themed font_focus_color, not in font_color', async () => {
    const { textColor } = await drawn(c, { hasFocus: true }, { font_focus_color: RED, font_color: GREEN });
    expect([textColor.r, textColor.g, textColor.b]).toEqual([1, 0, 0]);
  });

  it("draws Button's icon in a themed icon_focus_color, not in icon_normal_color", async () => {
    const colors = { icon_focus_color: RED, icon_normal_color: GREEN };
    const { ownIconColor } = await drawn(c, { hasFocus: true }, colors);
    expect([ownIconColor.r, ownIconColor.g, ownIconColor.b]).toEqual([1, 0, 0]);
  });

  it("draws Button's icon white where only icon_normal_color is themed (button.cpp:286-288)", async () => {
    const { ownIconColor } = await drawn(c, { hasFocus: true }, { icon_normal_color: GREEN });
    expect([ownIconColor.r, ownIconColor.g, ownIconColor.b]).toEqual([1, 1, 1]);
  });

  it('keeps the normal colours without focus', async () => {
    const colors = { font_focus_color: RED, font_color: GREEN, icon_focus_color: RED };
    const { textColor, ownIconColor } = await drawn(c, {}, colors);
    expect([textColor.r, textColor.g, textColor.b]).toEqual([0, 1, 0]);
    expect([ownIconColor.r, ownIconColor.g, ownIconColor.b]).toEqual([1, 1, 1]);
  });

  it('keeps the disabled colours while disabled, since focus colours belong to the normal draw mode', async () => {
    const colors = { font_focus_color: RED, font_disabled_color: GREEN };
    const { textColor } = await drawn(c, { hasFocus: true, disabled: true }, colors);
    expect([textColor.r, textColor.g, textColor.b]).toEqual([0, 1, 0]);
  });

  it('draws the focus box as one more mesh than the same button without focus', async () => {
    const focused = await drawn(c, { hasFocus: true });
    const plain = await drawn(c, {});
    expect(focused.meshCount).toBe(plain.meshCount + 1);
  });
});

describe.each(FAMILY)('a <$name> with a themed `icon` and none of its own (button.cpp:224-227)', (c) => {
  const themedIcon = { ref: OWN_ICON_REF, resources: OWN_ICON_SCOPE, isHeldLocally: true };
  // An OptionButton without a selection shows no item, so Button's icon is null as it is for the others.
  const withoutOwnIcon = c.name === 'OptionButton' ? { items: [] } : { icon: undefined };

  async function iconCount(icons: SolveNode['icons']) {
    const { Component } = c;
    // The solve tree sizes the `icon` slot by the themed icon, and leaves it null without one.
    const node = { ...familyNode(c, withoutOwnIcon, {}), icons, textureSize: icons.icon ? ICON_SIZE : null };
    const rendered = await renderWithOwnIcon(
      <Component {...painterEnv()} solveNode={node} rect={RECT} renderOrder={0} />,
      { w: ICON_SIZE.x, h: ICON_SIZE.y }
    );
    return findIconMeshes(rendered.scene).length;
  }

  it('draws the themed icon as one more icon quad', async () => {
    expect(await iconCount({ icon: themedIcon })).toBe((await iconCount({})) + 1);
  });
});

const SUBCLASSES_WITH_AN_OVERLAY = FAMILY.filter(({ name }) => name !== 'Button' && name !== 'MenuButton');

describe.each(SUBCLASSES_WITH_AN_OVERLAY)(
  'the element <$name> draws after Button (check_box.cpp:107, check_button.cpp:107, option_button.cpp:91)',
  (c) => {
    it('draws over the label, outline included, and under the next Control', async () => {
      const { Component } = c;
      const outlined = familyNode(c, {}, { constants: { outline_size: 4 } });
      const rendered = await renderWithOwnIcon(
        <Component {...painterEnv()} solveNode={outlined} rect={RECT} renderOrder={7} />,
        { w: ICON_SIZE.x, h: ICON_SIZE.y }
      );
      const meshes = rendered.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
      const element = findIconMeshes(rendered.scene).at(-1)!;
      const others = meshes.filter((mesh) => mesh !== element).map((mesh) => mesh.renderOrder);
      expect(element.renderOrder).toBeGreaterThan(Math.max(...others));
      expect(element.renderOrder).toBeLessThan(8);
    });
  }
);

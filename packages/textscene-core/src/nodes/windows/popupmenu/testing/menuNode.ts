/**
 * A PopupMenu `SolveNode` built as the scene lines `item_<n>/<leaf>` set it, for the tests of its
 * layout and drawing.
 */
import type { TscnNode } from '../../../../parser/types';
import { heading } from '../../../../parser/testing/parserKit';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { parsePopupMenu } from '../parser';

export interface ItemLines {
  text?: string;
  checkable?: number;
  checked?: boolean;
  disabled?: boolean;
  separator?: boolean;
  /** The icon's size, which stands in for the loaded texture. */
  icon?: { x: number; y: number };
}

/** A PopupMenu SolveNode with `items` set as the scene lines `item_<n>/<leaf>` set them. `extra` lines are written above the items, as Godot saves a Window's `size`, and `afterItems` below them. */
export function menu(
  items: readonly ItemLines[],
  extra: Record<string, string> = {},
  rtl = false,
  afterItems: Record<string, string> = {}
): SolveNode {
  const lines: Record<string, string> = { ...extra, item_count: String(items.length) };
  const textureSlots: Record<string, { x: number; y: number }> = {};
  items.forEach((item, index) => {
    if (item.text !== undefined) lines[`item_${index}/text`] = JSON.stringify(item.text);
    if (item.checkable) lines[`item_${index}/checkable`] = String(item.checkable);
    if (item.checked) lines[`item_${index}/checked`] = 'true';
    if (item.disabled) lines[`item_${index}/disabled`] = 'true';
    if (item.separator) lines[`item_${index}/separator`] = 'true';
    if (item.icon) {
      lines[`item_${index}/icon`] = 'ExtResource("1_icon")';
      textureSlots[`item_${index}/icon`] = item.icon;
    }
  });
  Object.assign(lines, afterItems);
  const node = {
    name: 'Menu',
    type: 'PopupMenu',
    children: [],
    properties: parsePopupMenu(heading('PopupMenu', { name: 'Menu' }), lines),
  };
  return { ...solveNode(), path: 'Menu', node: node as unknown as TscnNode, textureSlots, rtl };
}

export const text = (...labels: string[]): ItemLines[] => labels.map((label) => ({ text: label }));
export const many = (count: number): ItemLines[] =>
  text(...Array.from({ length: count }, (_, i) => `Item ${i}`));

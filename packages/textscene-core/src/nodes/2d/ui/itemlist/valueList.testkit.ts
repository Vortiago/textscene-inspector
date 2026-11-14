/** The value list of the ItemList minimum-size sweep: each case at the three sizes the solve asks for. */
import type { ItemListProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import { ItemListIconMode } from '../../../../godot/scene/gui';

export interface ItemListCase {
  name: string;
  props: Partial<ItemListProperties>;
  /** The natural icon sizes the tree build put in `textureSlots`, by item index. */
  icons?: Record<number, Vector2>;
  rtl?: boolean;
}

const AUTO = { autoWidth: true, autoHeight: true };
const words = (count: number) => Array.from({ length: count }, (_, i) => ({ text: `Item number ${i}` }));
const iconItems = [
  { text: 'Small', icon: 'res://small.png' },
  { text: 'Large icon here', icon: 'res://large.png' },
];
const ICONS = { 0: { x: 16, y: 16 }, 1: { x: 40, y: 24 } };

export const ITEM_LIST_CASES: readonly ItemListCase[] = [
  { name: 'no item', props: { ...AUTO, items: [] } },
  { name: 'one item with no text', props: { ...AUTO, items: [{ text: '' }] } },
  { name: 'icons of two sizes', props: { ...AUTO, items: iconItems }, icons: ICONS },
  {
    name: 'icons with fixed_icon_size',
    props: { ...AUTO, items: iconItems, fixedIconSize: { x: 20, y: 20 } },
    icons: ICONS,
  },
  {
    name: 'icon_mode top',
    props: { ...AUTO, items: iconItems, iconMode: ItemListIconMode.ICON_MODE_TOP },
    icons: ICONS,
  },
  {
    name: 'icon_mode left',
    props: { ...AUTO, items: iconItems, iconMode: ItemListIconMode.ICON_MODE_LEFT },
    icons: ICONS,
  },
  {
    name: 'max_text_lines 1, icon_mode top',
    props: { ...AUTO, items: words(3), iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 1 },
  },
  {
    name: 'max_text_lines 3, icon_mode top',
    props: { ...AUTO, items: words(3), iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 3 },
  },
  { name: 'max_columns 0', props: { ...AUTO, items: words(5), maxColumns: 0 } },
  { name: 'max_columns 1', props: { ...AUTO, items: words(5), maxColumns: 1 } },
  { name: 'max_columns 3', props: { ...AUTO, items: words(5), maxColumns: 3 } },
  { name: 'same_column_width', props: { ...AUTO, items: words(5), maxColumns: 3, sameColumnWidth: true } },
  { name: 'fixed_column_width 80', props: { ...AUTO, items: words(5), maxColumns: 3, fixedColumnWidth: 80 } },
  { name: 'auto_width only', props: { autoWidth: true, items: words(3) } },
  { name: 'auto_height only', props: { autoHeight: true, items: words(3) } },
  { name: 'auto_width and auto_height', props: { ...AUTO, items: words(3) } },
  { name: 'right to left', props: { ...AUTO, items: words(3) }, rtl: true },
  { name: 'more rows than fit', props: { ...AUTO, items: words(12) } },
];

export const ITEM_LIST_SIZES: readonly Vector2[] = [
  { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY },
  { x: 200, y: 100 },
  { x: 60, y: 40 },
];

/**
 * `<Tree>` — the native (WebGL canvas) painter for `Tree`: the `panel`
 * StyleBox across the whole rect, and — when `column_titles_visible` — one
 * blank-titled header cell per column (`Tree::_notification`'s
 * `NOTIFICATION_DRAW`, `tree.cpp:5091-5199`, restricted to what a `.tscn` can
 * ever populate).
 *
 * NO ROWS. `root` is always null: a Tree's `TreeItem`s are created only from
 * `create_item()` in script (`parser.ts`'s own doc), so
 * `if (root && ...) draw_item(...)` never fires for a scene-authored Tree —
 * an empty panel (plus its header, if shown) IS the whole truth of such a
 * scene, not a limitation this painter falls short of.
 *
 * NO TITLE TEXT. Column titles are equally script-only (`parser.ts`'s own
 * doc), so every header cell draws its `title_button_normal` chrome with
 * nothing inside it — never a placeholder string, which real Godot never
 * shows either.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate` — into `<StyleBoxQuad>`'s `color`, exactly like
 * `Panel`.
 *
 * This component never checks `props.visible`, never renders `children`, and
 * never applies a transform — all three are `ControlCanvasWalker`'s job.
 */
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import {
  pickTreePanelStyleBox,
  pickTreeTitleButtonStyleBox,
  treeTitleButtonHeightPx,
  treeContentRect,
  treeColumnWidthPx,
} from './nativeSolver';
import type { TreeProperties } from './types';

const TREE_COLUMNS_DEFAULT = 1;

export function Tree({ solveNode, tint, rect, renderOrder, theme }: NativeControlComponentProps) {
  const props = painterView<TreeProperties>(solveNode);
  const panelBox = pickTreePanelStyleBox(solveNode.styleBoxes, theme);
  const titleButtonBox = pickTreeTitleButtonStyleBox(solveNode.styleBoxes, theme);

  const columns = Math.max(1, props.columns ?? TREE_COLUMNS_DEFAULT);
  const titleHeightPx = treeTitleButtonHeightPx(props.columnTitlesVisible, titleButtonBox);
  const contentRect = treeContentRect({ x: rect.w, y: rect.h }, panelBox);
  const columnWidthPx = treeColumnWidthPx(contentRect.w, columns, props.columnTitlesVisible, titleButtonBox);

  return (
    <CanvasItemGroup>
      <StyleBoxQuad styleBox={panelBox} color={tint.own} rect={rect} renderOrder={renderOrder} />
      {props.columnTitlesVisible &&
        Array.from({ length: columns }, (_, i) => (
          <CanvasItemGroup key={i} position={[contentRect.x + i * columnWidthPx, -panelBox.contentMargin.top, 0]}>
            <StyleBoxQuad
              styleBox={titleButtonBox}
              color={tint.own}
              rect={{ x: 0, y: 0, w: columnWidthPx, h: titleHeightPx }}
              renderOrder={renderOrder}
            />
          </CanvasItemGroup>
        ))}
    </CanvasItemGroup>
  );
}

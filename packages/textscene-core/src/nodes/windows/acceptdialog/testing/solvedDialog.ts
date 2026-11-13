/** A dialog's internal Controls as the one solve places them, in window space, for a test to read. */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { controlProps, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { buttonRowNode, dialogBodyNodes, type DialogButtonRole } from '../dialogParts';

interface PlacedControl {
  control: SolveNode;
  rect: Rect2;
}

export interface SolvedDialog {
  /** The message label's rect, which every authored Control shares. */
  content: Rect2;
  /** The button row's rect. */
  row: Rect2;
  buttons: readonly { role: DialogButtonRole; text: string; rect: Rect2 }[];
  /** The visible Controls of the class's body in tree order, parents before children. */
  body: readonly PlacedControl[];
}

/** Every visible Control of the tree under `root`, offset by `origin`. */
function placeVisible(
  root: SolveNode,
  solved: ReadonlyMap<string, { rect: Rect2 }>,
  origin: Vector2
): PlacedControl[] {
  const entry = solved.get(root.path);
  if (!entry || controlProps(root).visible === false) return [];
  const rect = { ...entry.rect, x: origin.x + entry.rect.x, y: origin.y + entry.rect.y };
  return [{ control: root, rect }, ...root.children.flatMap((child) => placeVisible(child, solved, rect))];
}

/** Solves `dialog` at `size` with a fresh context, since a context memoises minimum sizes by path. */
/** The built OK and Cancel buttons, in row order. The spacers between them are plain Controls. */
function isButton(child: SolveNode): boolean {
  return child.node.type === 'Button';
}

export function solvedDialog(dialog: SolveNode, size: Vector2, theme: NativeTheme): SolvedDialog {
  const solved = solveControlTree(
    [dialog],
    { x: 0, y: 0, w: size.x, h: size.y },
    createSolveContext(theme, measureText)
  );
  const label = internalControlsOf(dialog, theme)[0]!.node;
  const row = buttonRowNode(dialog, theme);
  const rowRect = solved.get(row.path)!.rect;
  const buttons = row.children.filter(isButton).map((button) => {
    const role: DialogButtonRole = button.node.name === 'OkButton' ? 'ok' : 'cancel';
    const rect = solved.get(button.path)!.rect;
    return {
      role,
      text: (button.node.properties as { text: string }).text,
      rect: { ...rect, x: rowRect.x + rect.x, y: rowRect.y + rect.y },
    };
  });
  const body = dialogBodyNodes(dialog, theme).flatMap((root) => placeVisible(root, solved, { x: 0, y: 0 }));
  return { content: solved.get(label.path)!.rect, row: rowRect, buttons, body };
}

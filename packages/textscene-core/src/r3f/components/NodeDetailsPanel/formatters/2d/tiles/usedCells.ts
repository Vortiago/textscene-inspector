import type { CallResult } from '../../../../../../scene/nodeMethods';
import { arrayElementsOf } from '../../callResult';

/** `get_used_cells` answers `Array[Vector2i]`, one `Vector2i` a cell. */
export function usedCellCount(cells: CallResult): number {
  return arrayElementsOf(cells).length;
}

export function cellCountText(count: number): string {
  return `${count} cell${count === 1 ? '' : 's'}`;
}

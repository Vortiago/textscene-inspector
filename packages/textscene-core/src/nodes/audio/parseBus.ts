/**
 * Shared audio bus parser. `bus` is a StringName, so it arrives either quoted
 * (`"Master"`) or with Godot's sigil (`&"Master"`), and `unquoteStringName`
 * handles both. Default: "Master" (Godot's default bus).
 */
import { unquoteStringName } from '../../parser/utils';

export function parseBus(raw: string | undefined): string {
  if (!raw) return 'Master';
  return unquoteStringName(raw);
}

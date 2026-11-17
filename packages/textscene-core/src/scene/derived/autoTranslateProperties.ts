import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { boolValue, intValue, isTrue, numberOf } from './valueOf.js';

/** `Node::AutoTranslateMode` (`node.h:126-130`). */
const AutoTranslateMode = { INHERIT: 0, ALWAYS: 1, DISABLED: 2 } as const;

/** The `auto_translate` of a Control and a Window, over the stored `auto_translate_mode`. */
export class AutoTranslateProperties implements DerivedProperties {
  storedWritten(): void {}

  get(property: string, reads: NodeReads): VariantValue | undefined {
    return property === 'auto_translate' ? boolValue(canAutoTranslate(reads)) : undefined;
  }

  /** `control.cpp:3646-3649` and `window.cpp:3097-3100`. */
  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    if (property !== 'auto_translate') return undefined;
    const mode = isTrue(value) ? AutoTranslateMode.ALWAYS : AutoTranslateMode.DISABLED;
    return [['auto_translate_mode', intValue(mode)]];
  }
}

/** `Node::can_auto_translate` (`node.cpp:1352-1372`): the first mode up the tree that is not INHERIT. */
function canAutoTranslate({ stored, parent }: NodeReads): boolean {
  const own = numberOf(stored('auto_translate_mode'));
  if (own !== AutoTranslateMode.INHERIT) return own !== AutoTranslateMode.DISABLED;
  for (let node = parent(); node; node = node.parent()) {
    const mode = node.get('auto_translate_mode');
    if (mode && numberOf(mode) !== AutoTranslateMode.INHERIT)
      return numberOf(mode) === AutoTranslateMode.ALWAYS;
  }
  return true;
}

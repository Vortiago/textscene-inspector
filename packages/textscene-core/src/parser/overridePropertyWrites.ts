import { perObject } from '../utils/perObject.js';
import type { ParseObserver } from './TscnParserCore.js';

type PropertyBag = Record<string, string>;
type Write = readonly [string, string];

interface SourceProperties {
  file?: symbol;
  line?: number;
  writes?: readonly Write[];
}

const sourceOf = perObject((_: PropertyBag): SourceProperties => ({}));

export function headingFile(raw: PropertyBag): symbol | undefined {
  return sourceOf(raw).file;
}

export function headingLine(raw: PropertyBag): number {
  return sourceOf(raw).line ?? Infinity;
}

export function keepHeadingLine(from: PropertyBag, to: PropertyBag): void {
  sourceOf(to).line = sourceOf(from).line;
  sourceOf(to).file = sourceOf(from).file;
}

export function propertyWrites(raw: PropertyBag): readonly Write[] {
  return sourceOf(raw).writes ?? Object.entries(raw);
}

export function overlayPropertyWrites(base: PropertyBag, written: PropertyBag): PropertyBag {
  const merged = { ...base, ...written };
  keepHeadingLine(base, merged);
  if (
    !sourceOf(base).writes &&
    !sourceOf(written).writes &&
    !Object.keys(written).some((key) => Object.hasOwn(base, key))
  )
    return merged;
  sourceOf(merged).writes = [...propertyWrites(base), ...propertyWrites(written)];
  return merged;
}

export function mapPropertyWrites(
  raw: PropertyBag,
  map: (key: string, value: string) => { key: string; value: string }
): PropertyBag {
  let changed = false;
  const writes = propertyWrites(raw).map(([key, value]): Write => {
    const mapped = map(key, value);
    changed ||= mapped.key !== key || mapped.value !== value;
    return [mapped.key, mapped.value];
  });
  if (!changed) return raw;
  const mapped = Object.fromEntries(writes);
  keepHeadingLine(raw, mapped);
  if (writes.length > Object.keys(mapped).length) sourceOf(mapped).writes = writes;
  return mapped;
}

export function observeOverrideWrites(): ParseObserver {
  const file = Symbol();
  let writes: Write[] | undefined;
  const observer: ParseObserver = {
    onSectionStart(heading, section) {
      writes =
        section === 'node' && (!heading.attributes.type || heading.attributes.instance) ? [] : undefined;
      if (writes) {
        const current = writes;
        observer.onProperty = ({ stored }) => current.push([stored.key, stored.value]);
      } else {
        delete observer.onProperty;
      }
    },
    onSectionBuilt(section, line) {
      if (!('rawProperties' in section)) return;
      const { rawProperties } = section;
      const source = sourceOf(rawProperties);
      source.line = line;
      source.file = file;
      if (writes && writes.length > Object.keys(rawProperties).length) source.writes = writes;
    },
  };
  return observer;
}

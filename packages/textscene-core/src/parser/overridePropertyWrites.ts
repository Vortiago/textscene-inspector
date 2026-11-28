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
  from: PropertyBag,
  to: PropertyBag,
  map: (key: string, value: string) => Write
): void {
  keepHeadingLine(from, to);
  if (sourceOf(from).writes || Object.keys(from).length !== Object.keys(to).length) {
    sourceOf(to).writes = propertyWrites(from).map(([key, value]) => map(key, value));
  }
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
        observer.onProperty = ({ key, value }) => current.push([key, value]);
      } else {
        delete observer.onProperty;
      }
    },
    onSectionBuilt(section, line) {
      if ('rawProperties' in section) {
        sourceOf(section.rawProperties).line = line;
        sourceOf(section.rawProperties).file = file;
      }
      if (writes && 'rawProperties' in section && writes.length > Object.keys(section.rawProperties).length) {
        sourceOf(section.rawProperties).writes = writes;
      }
    },
  };
  return observer;
}

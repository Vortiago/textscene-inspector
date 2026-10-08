/**
 * The section a refusal is about. The validator knows only a key and a value, so the observer stamps each refusal
 * raised inside a section with that section's owner.
 */

import type { ParsedHeading } from '../../parser/utils.js';
import type { SectionType } from '../../parser/TscnParserCore.js';

/** The owner fields keep the `node*` names `ParseError` publishes, for a sub-resource too. */
export interface SectionOwner {
  nodeName: string;
  nodeType: string;
}

/**
 * The owner of a section that holds validated properties, or null for one that holds none. A sub-resource is named
 * by its `id=`, which tells one `[sub_resource type="CircleShape2D"]` from its siblings. `ext_resource`, `gd_scene`
 * and `gd_resource` carry no validated properties, and a `[resource]` body is the file's own single resource, which
 * no id identifies.
 */
export function sectionOwnerOf(heading: ParsedHeading, section: SectionType): SectionOwner | null {
  const { name, id, type } = heading.attributes;
  if (section === 'node') return { nodeName: name ?? '<unknown>', nodeType: type ?? '<unknown>' };
  if (section === 'sub_resource') return { nodeName: id ?? '<unknown>', nodeType: type ?? '<unknown>' };
  return null;
}

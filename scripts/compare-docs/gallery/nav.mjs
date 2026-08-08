/**
 * The nav: two levels, a category divider (3D / 2D / Resources / …) then a
 * sub-group per function (Lighting, Physics, UI, …).
 */

import { escapeHtml } from './markdown.mjs';
import { CATEGORY_ORDER, STATUS_LABEL } from './vocabulary.mjs';

/** A category whose only group is itself (Resources, Complex Scenes) shows no redundant sub-head. */
export function renderNav(nodes) {
  return CATEGORY_ORDER.map((category) => {
    const inCat = nodes.filter((n) => n.category === category);
    if (!inCat.length) return '';
    const byGroup = new Map();
    for (const n of inCat) {
      if (!byGroup.has(n.group)) byGroup.set(n.group, []);
      byGroup.get(n.group).push(n);
    }
    const groupNames = [...byGroup.keys()].sort();
    const bare = groupNames.length === 1 && groupNames[0] === category;
    const groupsHtml = groupNames
      .map(
        (gname) =>
          `<div class="nav-group">${bare ? '' : `<div class="nav-head">${escapeHtml(gname)}</div>`}${byGroup
            .get(gname)
            .map(
              (n) =>
                `<button class="nav-item" data-type="${n.type}" data-status="${n.status}"><span class="st st-${n.status}" title="${STATUS_LABEL[n.status]}"></span>${n.type}</button>`
            )
            .join('')}</div>`
      )
      .join('');
    return `<div class="nav-cat">${escapeHtml(category)}</div>${groupsHtml}`;
  }).join('');
}

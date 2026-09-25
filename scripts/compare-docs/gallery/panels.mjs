/**
 * A panel: one node's sheet, whatever its shape: a legacy single-pair sheet, a
 * sectioned one, an injected "not implemented" card, or the shared notes.
 */

import { escapeHtml, inline } from './markdown.mjs';
import { DEFAULT_STATUS, PREVIEW_URL, STATUS_LABEL } from './vocabulary.mjs';

/**
 * Every field the panel template reads. Each panel source spreads this and
 * overrides what it knows, so an unset field renders empty, not `undefined`.
 */
export const BLANK_PANEL = {
  docs: '',
  source: '',
  fixture: '',
  camera: '',
  rendersAs: '',
  group: '',
  status: DEFAULT_STATUS,
  visual: true,
  sectioned: false,
  sections: [],
  introHtml: '',
  trailingHtml: '',
  godot: null,
  ours: null,
  html: '',
};

/**
 * One Godot-vs-ours comparison widget (slider + side-by-side toggle). Reused for
 * a legacy single-pair sheet and for every per-property section. A missing image
 * pair renders a placeholder rather than a broken widget.
 */
export function compareStage(godot, ours, label) {
  if (!godot || !ours) {
    return `<div class="novisual">Comparison images not captured yet for ${escapeHtml(label)}.</div>`;
  }
  return `<div class="compare">
        <div class="stage">
          <img class="img-godot" src="${godot}" alt="Godot render of ${escapeHtml(label)}">
          <img class="img-ours" src="${ours}" alt="Our render of ${escapeHtml(label)}">
          <div class="handle"></div>
          <span class="tag g">Godot 4.6.3</span>
          <span class="tag o">Ours</span>
        </div>
        <div class="modes">
          <button data-mode="slider" aria-pressed="true">Slider</button>
          <button data-mode="sbs" aria-pressed="false">Side by side</button>
        </div>
      </div>`;
}

export function renderPanels(nodes) {
  return nodes
    .map(
      (n) => `
    <article class="sheet" data-type="${n.type}" hidden>
      <header class="sheet-head">
        <h2>${escapeHtml(n.type)}</h2>
        ${n.rendersAs ? `<span class="renders">renders as ${inline(n.rendersAs)}</span>` : ''}
        ${n.docs ? `<a class="reflink" href="${n.docs}" target="_blank" rel="noopener" title="Godot class reference for ${escapeHtml(n.type)}">docs ↗</a>` : ''}
        ${n.source ? `<a class="reflink" href="${n.source}" target="_blank" rel="noopener" title="Godot engine source for ${escapeHtml(n.type)}">source ↗</a>` : ''}
        ${
          n.fixture
            ? `<a class="fixture" href="${PREVIEW_URL}?fixture=${encodeURIComponent(
                n.fixture
              )}${
                n.camera ? `&camera=${encodeURIComponent(n.camera)}` : ''
              }" target="_blank" rel="noopener" title="Open ${escapeHtml(
                n.fixture
              )} in the previewer"><code>${escapeHtml(n.fixture)}</code> ↗</a>`
            : ''
        }
        ${n.notes ? '' : `<span class="status st-${n.status}">${STATUS_LABEL[n.status]}</span>`}
      </header>
      ${n.sectioned || n.notes ? '' : `<div class="status-note st-${n.status}"></div>`}
      ${n.introHtml ? `<div class="prose intro">${n.introHtml}</div>` : ''}
      ${
        n.notes
          ? `<div class="prose">${n.html}</div>`
          : n.unimplemented
          ? `<div class="novisual">Not yet implemented — the previewer renders this as a transform-only fallback (children still show, the node itself draws nothing). In Godot it is a <strong>${escapeHtml(
              n.group
            )}</strong> node.</div>${n.html ? `<div class="prose">${n.html}</div>` : ''}`
          : n.sectioned
            ? `${
                // The whole-scene pair, when the sheet declares one, above the
                // sections that break it down.
                n.visual && n.godot && n.ours ? compareStage(n.godot, n.ours, n.type) : ''
              }` +
              n.sections
                .map(
                  (s) => `
      <section class="prop">
        <div class="prop-head"><h3>${escapeHtml(s.title)}</h3><span class="status st-${
          s.status
        }">${STATUS_LABEL[s.status]}</span></div>
        ${compareStage(s.godot, s.ours, s.title)}
        <div class="prose">${s.html}</div>
      </section>`
                )
                .join('') +
              (n.trailingHtml ? `<div class="prose">${n.trailingHtml}</div>` : '')
            : `${
                n.visual
                  ? compareStage(n.godot, n.ours, n.type)
                  : `<div class="novisual">No visual output — this node draws nothing to compare.</div>`
              }
      <div class="prose">${n.html}</div>`
      }
    </article>`
    )
    .join('');
}

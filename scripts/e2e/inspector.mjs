/**
 * Inspector (NodeDetailsPanel) reading for the web-app E2E gate.
 *
 * `NodeDetailsPanel.tsx` renders `<h3>{node.name}</h3>` followed by one
 * `<div class=section>` per `PropertySection`, each a `<h4>{title}</h4>`
 * plus `<div class=row><span>{label}:</span><span>{value}</span></div>`
 * rows. The class names are CSS-module hashes in the built app — unusable as
 * selectors — so this walks plain DOM shape (h3 → its parent → child `div`s
 * that carry an `h4`) instead of any class name.
 */

/* global document */
// `document` exists only inside the `page.evaluate` callback below, which
// Playwright serialises and runs in the browser, never in this Node process.

/** The selected node's name and every property section, read from the live DOM. */
export async function readInspectorPanel(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h3');
    if (!heading) return null;
    const root = heading.parentElement;
    if (!root) return null;
    const sections = Array.from(root.children)
      .filter((child) => child.tagName === 'DIV' && child.querySelector(':scope > h4'))
      .map((section) => {
        const title = section.querySelector(':scope > h4')?.textContent ?? '';
        const rows = Array.from(section.children)
          .filter((row) => row.tagName === 'DIV')
          .map((row) => {
            const spans = row.querySelectorAll(':scope > span');
            const label = (spans[0]?.textContent ?? '').replace(/:$/, '');
            const value = spans[1]?.textContent ?? '';
            return { label, value };
          });
        return { title, rows };
      });
    return { name: heading.textContent ?? '', sections };
  });
}

/** The value of `sectionTitle`'s row labelled `rowLabel`, or `undefined` if either is absent. */
export function findRowValue(sections, sectionTitle, rowLabel) {
  const section = (sections ?? []).find((s) => s.title === sectionTitle);
  const row = section?.rows.find((r) => r.label === rowLabel);
  return row?.value;
}

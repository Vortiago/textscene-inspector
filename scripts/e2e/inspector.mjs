/**
 * Reads the inspector (`NodeDetailsPanel.tsx`) for the web-app E2E gate. Class
 * names are CSS-module hashes in the built app, so this walks the DOM shape:
 * `<h3>` name, then per section a `div` with an `<h4>` title and
 * `<span>{label}:</span><span>{value}</span>` rows.
 */

/* global document */
// `document` exists only in the browser that runs the `page.evaluate` callback.

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

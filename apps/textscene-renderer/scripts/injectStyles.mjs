/**
 * Puts a stylesheet into a bundle's JavaScript, so the bundle carries the styles of its CSS
 * Modules and its consumer's bundler needs no CSS handling.
 */

/** A hot reload evaluates the bundle again; the id lets the second load find the first load's element. */
const STYLE_ID = 'textscene-renderer-styles';

/**
 * @param {string} bundle - the ESM text of the bundle.
 * @param {string} css - the stylesheet esbuild emitted for the bundle, or '' for none.
 * @returns {string} the bundle, headed by a statement that adds `css` to the page's `<head>`. The
 *   statement keeps one element, however often the bundle loads, with the css of the last load. It
 *   does nothing where there is no `document`, so the bundle still loads in Node.
 */
export function injectStyles(bundle, css) {
  if (css === '') return bundle;
  return `if (typeof document !== 'undefined') {
  let style = document.getElementById(${JSON.stringify(STYLE_ID)});
  if (!style) {
    style = document.createElement('style');
    style.id = ${JSON.stringify(STYLE_ID)};
    document.head.appendChild(style);
  }
  style.textContent = ${JSON.stringify(css)};
}
${bundle}`;
}

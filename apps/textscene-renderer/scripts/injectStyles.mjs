/**
 * Puts a stylesheet into a bundle's JavaScript, so the bundle carries the styles of its CSS
 * Modules and its consumer's bundler needs no CSS handling.
 */

/**
 * @param {string} bundle - the ESM text of the bundle.
 * @param {string} css - the stylesheet esbuild emitted for the bundle, or '' for none.
 * @returns {string} the bundle, headed by a statement that adds `css` to the page's `<head>`. The
 *   statement does nothing where there is no `document`, so the bundle still loads in Node.
 */
export function injectStyles(bundle, css) {
  if (css === '') return bundle;
  return `if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
}
${bundle}`;
}

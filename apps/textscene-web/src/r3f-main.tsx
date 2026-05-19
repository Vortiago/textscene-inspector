/**
 * R3F entry point for the web app. Mounted when ?r3f=1 is present in the
 * URL. Replaces the entire imperative UI with the empty <TscnCanvas>
 * until WI-R3F-3 adds node components and WI-R3F-4 brings the surrounding
 * panels back as React components.
 */
import { createRoot } from 'react-dom/client';
import { TscnCanvas } from '@textscene/core';

export function mountR3F(container: HTMLElement): void {
  // Reset the container so the imperative HTML scaffolding doesn't
  // interfere with the React-controlled tree.
  container.innerHTML = '';

  // The empty canvas needs an actual viewport size; CSS Modules on the
  // component side handle the layout, but we have to give the host div
  // a non-zero size since the parent #app is grid-based.
  container.style.display = 'block';
  container.style.width = '100vw';
  container.style.height = '100vh';

  const root = createRoot(container);
  root.render(<TscnCanvas />);
}

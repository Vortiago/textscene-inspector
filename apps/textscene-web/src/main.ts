/**
 * Standalone web application for previewing TSCN files.
 */

import { TscnPreviewUI, sharedStyles, info, error } from '@textscene/core';
import type { TscnPreviewElements, MissingResource } from '@textscene/core';
import { initLogger } from './logger';
import { getFixturesByCategory } from './fixtures';
import { WebResourceProvider } from './providers/WebResourceProvider';

initLogger();

// WI-R3F-1: R3F renderer is mountable behind the ?r3f=1 query flag. When
// the flag is set, the imperative UI is skipped entirely. Node components
// land in WI-R3F-3 and the surrounding UI panels return as React in
// WI-R3F-4. Until then this path renders only the empty canvas + default
// lighting.
const useR3F = new URLSearchParams(window.location.search).get('r3f') === '1';

if (useR3F) {
  const appElement = document.getElementById('app');
  if (!appElement) {
    throw new Error('Missing #app container for R3F mount');
  }
  void import('./r3f-main').then(({ mountR3F }) => mountR3F(appElement));
} else {
  void bootstrapImperativeUI();
}

async function bootstrapImperativeUI(): Promise<void> {

// Inject shared UI styles
const styleElement = document.createElement('style');
styleElement.textContent = sharedStyles;
document.head.appendChild(styleElement);

const fileInput = document.getElementById('file-upload') as HTMLInputElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resetButton = document.getElementById('reset-camera') as HTMLButtonElement;
const resourceFilesPanel = document.getElementById('resource-files') as HTMLDivElement;
const resourceFilesList = document.getElementById('resource-files-list') as HTMLDivElement;

const elements: TscnPreviewElements = {
  canvas,
  errorDisplay: document.getElementById('error-display') as HTMLDivElement,
  errorMessage: document.getElementById('error-message') as HTMLParagraphElement,
  sceneInfo: document.getElementById('scene-info') as HTMLDivElement,
  nodeCount: document.getElementById('node-count') as HTMLParagraphElement,
  rootNode: document.getElementById('root-node') as HTMLParagraphElement,
  treeViewerContainer: document.getElementById('tree-viewer-container') as HTMLDivElement,
  expandAllBtn: document.getElementById('expand-all-btn') as HTMLButtonElement,
  collapseAllBtn: document.getElementById('collapse-all-btn') as HTMLButtonElement,
  treeSearchInput: document.getElementById('tree-search') as HTMLInputElement,
  nodeDetailsPanel: document.getElementById('node-details-panel') as HTMLDivElement,
  detailsNodeName: document.getElementById('details-node-name') as HTMLHeadingElement,
  detailsContent: document.getElementById('details-content') as HTMLDivElement,
};

// Create resource provider (loads from uploaded files only)
const resourceProvider = new WebResourceProvider();

// Track missing resources for UI
const missingResourcesMap = new Map<string, MissingResource>();

function updateResourceFilesList(): void {
  const uploadedFiles = resourceProvider.getUploadedFiles();
  const hasMissing = missingResourcesMap.size > 0;
  const hasUploaded = uploadedFiles.size > 0;

  if (!hasMissing && !hasUploaded) {
    resourceFilesPanel.classList.remove('visible');
    return;
  }

  // Show panel
  resourceFilesPanel.classList.add('visible');

  // Clear existing list
  resourceFilesList.innerHTML = '';

  // Add uploaded files first (with green indicator)
  uploadedFiles.forEach((_file, path) => {
    const item = document.createElement('div');
    item.className = 'resource-file-item uploaded';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'resource-file-icon uploaded';
    iconDiv.textContent = '✓';

    const pathDiv = document.createElement('div');
    pathDiv.className = 'resource-file-path';
    pathDiv.textContent = path;

    const actionDiv = document.createElement('div');
    actionDiv.className = 'resource-file-action';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'resource-file-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      resourceProvider.getUploadedFiles().delete(path);
      updateResourceFilesList();
      info('[Resource Files] Removed:', path);
    };

    actionDiv.appendChild(removeBtn);
    item.appendChild(iconDiv);
    item.appendChild(pathDiv);
    item.appendChild(actionDiv);
    resourceFilesList.appendChild(item);
  });

  // Add missing files (with yellow indicator)
  missingResourcesMap.forEach((resource) => {
    const item = document.createElement('div');
    item.className = 'resource-file-item missing';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'resource-file-icon missing';
    iconDiv.textContent = '⚠';

    const pathDiv = document.createElement('div');
    pathDiv.className = 'resource-file-path';
    pathDiv.textContent = resource.path;

    const actionDiv = document.createElement('div');
    actionDiv.className = 'resource-file-action';

    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.style.fontSize = '0.7rem';
    uploadInput.style.padding = '0.25rem 0.375rem';
    uploadInput.style.width = 'auto';
    uploadInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      info('[Resource Files] User uploaded:', resource.path);

      // Add to provider's cache
      resourceProvider.addUploadedFile(resource.path, file);

      // Remove from missing map
      missingResourcesMap.delete(resource.path);

      // Update UI first
      updateResourceFilesList();

      // Provide to renderer (tree viewer will auto-refresh via lifecycle events)
      await previewUI.getRenderer().provideResource(resource.path);
    };

    actionDiv.appendChild(uploadInput);
    item.appendChild(iconDiv);
    item.appendChild(pathDiv);
    item.appendChild(actionDiv);
    resourceFilesList.appendChild(item);
  });
}

function addMissingResourceToUI(resource: MissingResource): void {
  if (missingResourcesMap.has(resource.path)) {
    return; // Already in UI
  }

  missingResourcesMap.set(resource.path, resource);
  info('[Resource Files] Adding missing resource:', resource.path);

  // Update unified list
  updateResourceFilesList();
}

const previewUI = new TscnPreviewUI(elements, {
  customResize: (canvas, renderer) => {
    const container = canvas.parentElement;
    if (container) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
      renderer.resize(width, height);
    }
  },
  onResourceNeeded: async (resource) => {
    info('[Resource Needed]', resource);
    addMissingResourceToUI(resource);
    return null; // User will upload later
  },
  resourceProvider,
});

fileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    // Clear previous missing resources when loading new scene
    missingResourcesMap.clear();
    updateResourceFilesList();

    const content = await file.text();
    await previewUI.loadTscn(content);
    resetButton.disabled = false;
  } catch (err) {
    error('Error loading TSCN:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    previewUI.showError(`Failed to load file: ${errorMessage}`);
  }
});

resetButton.addEventListener('click', () => {
  previewUI.resetCamera();
});

const fixturesHeader = document.getElementById('fixtures-header') as HTMLDivElement;
const fixturesList = document.getElementById('fixtures-list') as HTMLDivElement;

// Track current fixture fetch to abort on rapid clicks
let currentFixtureAbortController: AbortController | null = null;

function renderFixtureList() {
  const fixturesByCategory = getFixturesByCategory();
  const categoriesHtml: string[] = [];

  for (const [category, fixtures] of fixturesByCategory) {
    categoriesHtml.push(`<div class="fixture-category">${category}</div>`);
    for (const fixture of fixtures) {
      categoriesHtml.push(
        `<div class="fixture-item" data-fixture="${fixture.file}">${fixture.name}</div>`
      );
    }
  }

  fixturesList.innerHTML = categoriesHtml.join('');

  fixturesList.querySelectorAll('.fixture-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const fixtureFile = (item as HTMLElement).dataset.fixture;
      if (!fixtureFile) return;

      // Abort previous fetch if still in progress
      if (currentFixtureAbortController) {
        currentFixtureAbortController.abort();
      }

      // Create new AbortController for this fetch
      currentFixtureAbortController = new AbortController();

      try {
        const response = await fetch(`/fixtures/${fixtureFile}`, {
          signal: currentFixtureAbortController.signal
        });
        if (!response.ok) {
          throw new Error(`Failed to load fixture: ${response.statusText}`);
        }

        // Clear previous missing resources when loading new scene
        missingResourcesMap.clear();
        updateResourceFilesList();

        const content = await response.text();
        await previewUI.loadTscn(content);
        resetButton.disabled = false;
      } catch (err) {
        // Ignore AbortError (expected when user clicks another fixture)
        if (err instanceof Error && err.name === 'AbortError') {
          info('Fixture load aborted (user clicked another fixture)');
          return;
        }
        error('Error loading fixture:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        previewUI.showError(`Failed to load fixture: ${errorMessage}`);
      }
    });
  });
}

fixturesHeader.addEventListener('click', () => {
  const toggle = fixturesHeader.querySelector('.fixtures-toggle');
  toggle?.classList.toggle('expanded');
  fixturesList.classList.toggle('expanded');
});

renderFixtureList();
} // end bootstrapImperativeUI

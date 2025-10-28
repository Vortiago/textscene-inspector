/**
 * Standalone web application for previewing TSCN files.
 */

import { TscnPreviewUI } from '@textscene/renderer';
import type { TscnPreviewElements } from '@textscene/renderer';
import { initLogger } from './logger';
import { getFixturesByCategory } from './fixtures';

initLogger();

const fileInput = document.getElementById('file-upload') as HTMLInputElement;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resetButton = document.getElementById('reset-camera') as HTMLButtonElement;

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
});

fileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    previewUI.loadTscn(content);
    resetButton.disabled = false;
  } catch (error) {
    console.error('Error loading TSCN:', error);
  }
});

resetButton.addEventListener('click', () => {
  previewUI.resetCamera();
});

const fixturesHeader = document.getElementById('fixtures-header') as HTMLDivElement;
const fixturesList = document.getElementById('fixtures-list') as HTMLDivElement;

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

      try {
        const response = await fetch(`/fixtures/${fixtureFile}`);
        if (!response.ok) {
          throw new Error(`Failed to load fixture: ${response.statusText}`);
        }
        const content = await response.text();
        previewUI.loadTscn(content);
        resetButton.disabled = false;
      } catch (error) {
        console.error('Error loading fixture:', error);
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

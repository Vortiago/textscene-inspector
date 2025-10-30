/**
 * Formats TSCN node details as HTML for display in the details panel.
 */

import type { TscnNode } from '../parser/types';
import type { PropertySection, PropertyItem } from '../core/NodeRegistry';
import { nodeRegistry } from '../core/NodeRegistry';

export function formatNodeDetails(node: TscnNode, path: string): string {
  let html = renderBaseProperties(node, path);

  // Get registered property formatter for this node type
  const registration = nodeRegistry.getRegistration(node.type);
  if (registration?.propertyFormatter) {
    const sections = registration.propertyFormatter(node.properties);
    html += renderPropertySections(sections);
  }

  return html;
}

function renderBaseProperties(node: TscnNode, path: string): string {
  let html = `
    <div class="detail-row">
      <span class="detail-label">Type:</span>
      <span class="detail-value">${node.type}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Path:</span>
      <span class="detail-value">${path}</span>
    </div>
  `;

  if (node.parent) {
    html += `
      <div class="detail-row">
        <span class="detail-label">Parent:</span>
        <span class="detail-value">${node.parent}</span>
      </div>
    `;
  }

  if (node.instance) {
    html += `
      <div class="detail-row detail-external-instance">
        <span class="detail-label">📦 External Scene:</span>
        <span class="detail-value">${node.instance}</span>
      </div>
    `;
  }

  return html;
}

function renderPropertySections(sections: PropertySection[]): string {
  let html = '';

  for (const section of sections) {
    html += `
      <div class="property-section">
        <h4>${section.title}</h4>
    `;

    for (const item of section.items) {
      html += renderPropertyItem(item);
    }

    html += `
      </div>
    `;
  }

  return html;
}

function renderPropertyItem(item: PropertyItem): string {
  return `
    <div class="detail-row">
      <span class="detail-label">${item.label}:</span>
      <span class="detail-value">${item.value}</span>
    </div>
  `;
}

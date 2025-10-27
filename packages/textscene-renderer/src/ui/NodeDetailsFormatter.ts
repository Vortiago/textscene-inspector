/**
 * Formats TSCN node details as HTML for display in the details panel.
 */

import type { TscnNode } from '../parser/types';

/**
 * Generates HTML content for node details panel.
 */
export function formatNodeDetails(node: TscnNode, path: string): string {
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

  html += formatTransformDetails(node);
  html += formatMeshDetails(node);

  return html;
}

/**
 * Formats transform details if the node has transform properties.
 */
function formatTransformDetails(node: TscnNode): string {
  if (!('transform' in node.properties) || !node.properties.transform) {
    return '';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transform properties vary by node type, safe with optional chaining
  const transform = node.properties.transform as any;
  let html = `
    <div class="transform-section">
      <h4>Transform</h4>
      <div class="transform-grid">
        <span class="transform-axis">X:</span>
        <span class="transform-value">${transform.origin?.x?.toFixed(3) ?? 'N/A'}</span>
        <span class="transform-axis">Y:</span>
        <span class="transform-value">${transform.origin?.y?.toFixed(3) ?? 'N/A'}</span>
        <span class="transform-axis">Z:</span>
        <span class="transform-value">${transform.origin?.z?.toFixed(3) ?? 'N/A'}</span>
      </div>
    </div>
  `;

  if (transform.basis) {
    html += `
      <div class="transform-section">
        <h4>Basis (Rotation/Scale)</h4>
        <div class="transform-grid">
          <span class="transform-axis">X:</span>
          <span class="transform-value">[${transform.basis.x?.x?.toFixed(3) ?? 0}, ${transform.basis.x?.y?.toFixed(3) ?? 0}, ${transform.basis.x?.z?.toFixed(3) ?? 0}]</span>
          <span class="transform-axis">Y:</span>
          <span class="transform-value">[${transform.basis.y?.x?.toFixed(3) ?? 0}, ${transform.basis.y?.y?.toFixed(3) ?? 0}, ${transform.basis.y?.z?.toFixed(3) ?? 0}]</span>
          <span class="transform-axis">Z:</span>
          <span class="transform-value">[${transform.basis.z?.x?.toFixed(3) ?? 0}, ${transform.basis.z?.y?.toFixed(3) ?? 0}, ${transform.basis.z?.z?.toFixed(3) ?? 0}]</span>
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Formats mesh details for MeshInstance3D nodes.
 */
function formatMeshDetails(node: TscnNode): string {
  if (node.type !== 'MeshInstance3D' || !('mesh' in node.properties)) {
    return '';
  }

  return `
    <div class="detail-row">
      <span class="detail-label">Mesh:</span>
      <span class="detail-value">${node.properties.mesh}</span>
    </div>
  `;
}

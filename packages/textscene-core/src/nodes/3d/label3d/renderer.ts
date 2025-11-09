/**
 * Label3D renderer - creates three.js Mesh with canvas-rendered text
 */

import * as THREE from 'three';
import type { Label3DProperties } from './types';
import type { Color } from '../../../utils/colorParser';
import { applyNode3DTransform } from '../../base/node3d/renderer';

/**
 * Create a Label3D with canvas-rendered text
 * Returns a THREE.Mesh with PlaneGeometry and canvas texture
 */
export function createLabel3D(name: string, properties: Label3DProperties): THREE.Mesh {
  const text = properties.text || '';
  const pixelSize = properties.pixel_size;
  const billboardMode = properties.billboard;
  const modulate = properties.modulate;
  const outlineSize = properties.outline_size;
  const outlineModulate = properties.outline_modulate;

  // Create canvas with text
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // Set canvas size based on text length
  const fontSize = 128; // High resolution for quality
  context.font = `${fontSize}px Arial`;
  const metrics = context.measureText(text);
  canvas.width = Math.ceil(metrics.width) + 20;
  canvas.height = fontSize + 20;

  // Draw outline if specified
  if (outlineSize > 0) {
    context.font = `${fontSize}px Arial`;
    context.strokeStyle = colorToHex(outlineModulate);
    context.lineWidth = outlineSize * 10;
    context.strokeText(text, 10, fontSize);
  }

  // Draw text
  context.fillStyle = colorToHex(modulate);
  context.font = `${fontSize}px Arial`;
  context.fillText(text, 10, fontSize);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Calculate plane dimensions based on pixel_size
  const aspect = canvas.width / canvas.height;
  const width = pixelSize * aspect * 100;
  const height = pixelSize * 100;

  // Create plane geometry and material
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: modulate.a,
    side: THREE.DoubleSide,  // Visible from both sides
    depthWrite: false,       // Prevent z-fighting with other labels
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;

  // Apply transform
  applyNode3DTransform(mesh, properties);

  // Store billboard mode in userData for update loop
  mesh.userData.isLabel3D = true;
  mesh.userData.billboardMode = billboardMode;
  mesh.userData.nodeType = 'Label3D';

  return mesh;
}

/**
 * Convert Color to CSS hex string for canvas
 */
function colorToHex(color: Color): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}

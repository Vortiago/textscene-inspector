/**
 * Parsing for external and internal TSCN resources.
 */

import type { TscnExternalResource, TscnInternalResource } from './types';
import type { ParsedHeading } from './utils';

export interface ParsedResource {
  type: string;
  properties: Record<string, unknown>;
}

export interface ParsedColor {
  type: 'Color';
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ParsedVector3 {
  type: 'Vector3';
  x: number;
  y: number;
  z: number;
}

export function parseExternalResource(heading: ParsedHeading | null): TscnExternalResource | null {
  if (!heading) return null;

  const id = heading.attributes.id;
  const path = heading.attributes.path;
  const type = heading.attributes.type;

  return {
    id: id || '',
    path: path || '',
    type: type || '',
  };
}

export function parseInternalResource(
  heading: ParsedHeading | null,
  properties: Record<string, string>
): TscnInternalResource | null {
  if (!heading) return null;

  const id = heading.attributes.id;
  const type = heading.attributes.type;

  return {
    id: id || '',
    type: type || '',
    data: { ...properties, id },
  };
}

/**
 * Parse Godot resource file (.tres) format.
 */
export function parseResourceFile(content: string): ParsedResource {
  const lines = content.split('\n');

  // Parse header: [gd_resource type="StandardMaterial3D" format=3]
  const headerLine = lines.find(line => line.trim().startsWith('[gd_resource'));
  if (!headerLine) {
    throw new Error('Invalid .tres file: missing [gd_resource] header');
  }

  const typeMatch = headerLine.match(/type="([^"]+)"/);
  if (!typeMatch || !typeMatch[1]) {
    throw new Error('Invalid .tres file: missing type attribute');
  }
  const resourceType = typeMatch[1];

  // Find [resource] section
  const resourceIndex = lines.findIndex(line => line.trim() === '[resource]');
  if (resourceIndex === -1) {
    throw new Error('Invalid .tres file: missing [resource] section');
  }

  // Parse properties until next section or EOF
  const properties: Record<string, unknown> = {};
  for (let i = resourceIndex + 1; i < lines.length; i++) {
    const lineContent = lines[i];
    if (!lineContent) continue;
    const line = lineContent.trim();

    // Stop at next section
    if (line.startsWith('[')) break;

    // Skip empty lines and comments
    if (!line || line.startsWith(';')) continue;

    // Parse property: key = value
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (match && match[1] && match[2]) {
      const key = match[1];
      const valueStr = match[2];
      properties[key] = parsePropertyValue(valueStr);
    }
  }

  return { type: resourceType, properties };
}

/**
 * Parse property value (Color, Vector3, numbers, strings, etc.).
 */
function parsePropertyValue(valueStr: string): unknown {
  // Color(r, g, b, a)
  const colorMatch = valueStr.match(/Color\(([^)]+)\)/);
  if (colorMatch && colorMatch[1]) {
    const parts = colorMatch[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 4 && parts[0] !== undefined && parts[1] !== undefined &&
        parts[2] !== undefined && parts[3] !== undefined) {
      const color: ParsedColor = {
        type: 'Color',
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: parts[3]
      };
      return color;
    }
  }

  // Vector3(x, y, z)
  const vec3Match = valueStr.match(/Vector3\(([^)]+)\)/);
  if (vec3Match && vec3Match[1]) {
    const parts = vec3Match[1].split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 3 && parts[0] !== undefined && parts[1] !== undefined && parts[2] !== undefined) {
      const vec3: ParsedVector3 = {
        type: 'Vector3',
        x: parts[0],
        y: parts[1],
        z: parts[2]
      };
      return vec3;
    }
  }

  // Boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;

  // Number
  const num = parseFloat(valueStr);
  if (!isNaN(num)) return num;

  // String (remove quotes)
  if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
    return valueStr.slice(1, -1);
  }

  // ExtResource reference - keep as string for further processing
  if (valueStr.startsWith('ExtResource(')) {
    return valueStr;
  }

  // SubResource reference - keep as string for further processing
  if (valueStr.startsWith('SubResource(')) {
    return valueStr;
  }

  // Default: return as string
  return valueStr;
}

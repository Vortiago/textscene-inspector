/**
 * Parsing for external and internal TSCN resources.
 */

import type { TscnExternalResource, TscnInternalResource } from './types';
import type { ParsedHeading } from './utils';

export interface ParsedResource {
  type: string;
  properties: Record<string, unknown>;
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
  // Boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;

  // Number (but not Color/Vector3/resource references which start with letters)
  if (/^[-\d.]/.test(valueStr)) {
    const num = parseFloat(valueStr);
    if (!isNaN(num)) return num;
  }

  // String (remove quotes)
  if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
    return valueStr.slice(1, -1);
  }

  // Color, Vector3, ExtResource, SubResource, and other values — keep as string
  return valueStr;
}

/**
 * Parsing utilities for TSCN heading-based format.
 */

export interface ParsedHeading {
  type: string;
  attributes: Record<string, string>;
}

/**
 * Parse a heading line from TSCN format.
 * Example: [node name="Hallway" type="Node3D"]
 */
export function parseHeading(line: string): ParsedHeading | null {
  const trimmed = line.trim();

  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const content = trimmed.slice(1, -1).trim();

  const spaceIndex = content.indexOf(' ');
  if (spaceIndex === -1) {
    return { type: content, attributes: {} };
  }

  const type = content.slice(0, spaceIndex);
  const attributesStr = content.slice(spaceIndex + 1);

  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=("(?:[^"\\]|\\.)*"|[^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(attributesStr)) !== null) {
    const key = match[1];
    let value = match[2];

    if (!key || !value) continue;

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
      value = value.replace(/\\"/g, '"');
    }

    attributes[key] = value;
  }

  return { type, attributes };
}

/**
 * Parse a property line from TSCN format.
 * Example: transform = Transform3D(...)
 */
export function parseProperty(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  const value = trimmed.slice(equalsIndex + 1).trim();

  return { key, value };
}

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

export function isComment(line: string): boolean {
  return line.trim().startsWith(';');
}

export function isEmpty(line: string): boolean {
  return line.trim().length === 0;
}

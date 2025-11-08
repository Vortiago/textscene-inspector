import * as vscode from 'vscode';

/**
 * Provides "Go to Definition" for SubResource and ExtResource references in TSCN files.
 */
export class TscnDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
    const resource = this.getResourceIdAtPosition(document, position);

    if (!resource) {
      return null;
    }

    const definition = this.findResourceDefinition(
      document,
      resource.type,
      resource.id
    );

    return definition;
  }

  private getResourceIdAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): { type: 'SubResource' | 'ExtResource'; id: string } | null {
    const line = document.lineAt(position).text;
    const cursorOffset = position.character;

    // Match SubResource("id") or ExtResource("id")
    // Handles: SubResource("id"), SubResource('id'), SubResource( "id" ), etc.
    const subResourceRegex = /SubResource\s*\(\s*["']([^"']+)["']\s*\)/g;
    const extResourceRegex = /ExtResource\s*\(\s*["']([^"']+)["']\s*\)/g;

    // Check if cursor is within a SubResource call
    let match;
    subResourceRegex.lastIndex = 0;
    while ((match = subResourceRegex.exec(line)) !== null) {
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      if (cursorOffset >= startIndex && cursorOffset <= endIndex) {
        return { type: 'SubResource', id: match[1]! };
      }
    }

    // Check if cursor is within an ExtResource call
    extResourceRegex.lastIndex = 0;
    while ((match = extResourceRegex.exec(line)) !== null) {
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      if (cursorOffset >= startIndex && cursorOffset <= endIndex) {
        return { type: 'ExtResource', id: match[1]! };
      }
    }

    return null;
  }

  private findResourceDefinition(
    document: vscode.TextDocument,
    resourceType: 'SubResource' | 'ExtResource',
    resourceId: string
  ): vscode.Location | null {
    const text = document.getText();
    const lines = text.split('\n');

    // Determine heading prefix
    const headingPrefix =
      resourceType === 'SubResource' ? '[sub_resource' : '[ext_resource';

    // Search for matching resource definition
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Check if line starts with resource heading
      if (!line.startsWith(headingPrefix)) {
        continue;
      }

      // Extract id attribute from heading
      // Matches: id="value" or id='value'
      const idMatch = line.match(/id\s*=\s*["']([^"']+)["']/);

      if (!idMatch) {
        continue;
      }

      const definitionId = idMatch[1];

      if (definitionId === resourceId) {
        // Found the definition
        const range = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(i, line.length)
        );

        return new vscode.Location(document.uri, range);
      }
    }

    // Definition not found
    return null;
  }
}

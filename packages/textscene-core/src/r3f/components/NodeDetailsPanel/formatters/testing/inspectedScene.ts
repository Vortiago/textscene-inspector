import '../../../../sceneLiveTree.js';
import { openScene } from '../../../../../scene/openScene';
import { inspectedNode, type Formatter, type PropertySection } from '../inspectedNode';

/** Resources the node's texts name: `ExtResource("<id>")` and `SubResource("<id>")`, each of `type`. */
export interface NamedResources {
  readonly ext?: Readonly<Record<string, string>>;
  readonly sub?: Readonly<Record<string, string>>;
}

export const SCENE_PATH = 'res://inspected.tscn';

/** The scene: each resource of `resources`, then a root `Main` whose child `Node` is of `type`. */
export function inspectedSceneText(
  type: string,
  properties: Readonly<Record<string, string>>,
  resources: NamedResources = {}
): string {
  const ext = Object.entries(resources.ext ?? {}).map(
    ([id, resourceType]) => `[ext_resource type="${resourceType}" path="res://${id}" id="${id}"]`
  );
  const sub = Object.entries(resources.sub ?? {}).map(
    ([id, resourceType]) => `[sub_resource type="${resourceType}" id="${id}"]`
  );
  const texts = Object.entries(properties).map(([name, text]) => `${name} = ${text}`);
  return [
    '[gd_scene format=3]',
    ...ext,
    ...sub,
    '[node name="Main" type="Node"]',
    `[node name="Node" type="${type}" parent="."]`,
    ...texts,
    '',
  ].join('\n\n');
}

/** The sections `formatter` gives the node. */
export async function sectionsOf(
  formatter: Formatter,
  type: string,
  properties: Readonly<Record<string, string>> = {},
  resources: NamedResources = {}
): Promise<PropertySection[]> {
  return sectionsAt(inspectedSceneText(type, properties, resources), 'Node', formatter);
}

/** The sections `formatter` gives the node at `path` from the root of the scene `source`. */
export async function sectionsAt(
  source: string,
  path: string,
  formatter: Formatter
): Promise<PropertySection[]> {
  const scene = openScene({
    source,
    rootScenePath: SCENE_PATH,
    provider: { loadResource: async () => null },
  });
  const node = scene.getNode(path);
  return formatter(inspectedNode(node, scene.fileProperties(node.path)));
}

/** The value of the first row labelled `label`. */
export function valueOf(sections: readonly PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((entry) => entry.label === label);
    if (item) return item.value;
  }
  return undefined;
}

/** The section titled `title` that `formatter` gives a node of `type` that sets `properties`. */
export async function sectionIn(
  formatter: Formatter,
  type: string,
  title: string,
  properties: Readonly<Record<string, string>> = {},
  resources: NamedResources = {}
): Promise<PropertySection | undefined> {
  return sectionTitled(await sectionsOf(formatter, type, properties, resources), title);
}

export function sectionTitled(
  sections: readonly PropertySection[],
  title: string
): PropertySection | undefined {
  return sections.find((section) => section.title === title);
}

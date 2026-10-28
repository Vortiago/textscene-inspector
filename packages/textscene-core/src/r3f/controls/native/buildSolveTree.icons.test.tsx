/**
 * `useBuildSolveTree` resolves a Control's icons as `Control::get_theme_icon` does
 * (`scene/gui/control.cpp:3035-3055`, `scene/theme/theme_owner.cpp:227-261`): a
 * local override wins, else the nearest ancestor or project Theme that resolves
 * `<Type>/icons/<name>`, else nothing.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext';
import { useBuildSolveTree } from './buildSolveTree';
import type { SolveNode } from './solveTree';
import { controlNode } from './testing/solveNode';
import { themeResource } from './testing/themeResource';
import { isLocalToScene } from '../../../resources/textures/viewporttexture/localToScene';

/** A Theme that declares `icons`, in a theme-file scope of its own. */
function iconTheme(icons: Record<string, Record<string, string>>): ThemeResource {
  return themeResource({
    icons,
    resources: {
      externalResources: [{ id: '1', path: 'res://icon.png', type: 'Texture2D' }],
      internalResources: [],
    },
  });
}

function checkBox(overrides?: Record<string, string>): TscnNode {
  return controlNode('Box', 'CheckBox', overrides ? { themeOverrideIcons: overrides } : {});
}

/** Each theme wraps the next as a Control ancestor, the first outermost, with `leaf` innermost. */
function themedAncestors(themes: readonly ThemeResource[], leaf: TscnNode) {
  const fake = createFakeResourceLoader();
  const externalResources = themes.map((t, i) => {
    const path = `res://theme_${i}.tres`;
    fake.themes.seed(path, t);
    return { id: `theme_${i}`, path, type: 'Theme' };
  });
  const root = themes.reduceRight<TscnNode>(
    (child, _theme, i) => ({
      ...controlNode(`Theme${i}`, 'Control', { theme: `ExtResource("theme_${i}")` }),
      children: [child],
    }),
    leaf
  );
  return { loader: fake.loader, nodes: [root], externalResources };
}

/** The solved leaf under `themes`, nested as `themedAncestors` nests them. */
function solvedLeaf(themes: readonly ThemeResource[], leaf: TscnNode): SolveNode {
  const { loader, nodes, externalResources } = themedAncestors(themes, leaf);
  const { result } = renderHook(() => useBuildSolveTree(nodes, externalResources, []), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
    ),
  });
  let solved = result.current.tree[0]!;
  while (solved.children.length > 0) solved = solved.children[0]!;
  return solved;
}

describe('useBuildSolveTree icons', () => {
  it('lets a local theme_override_icons/<name> win over an ancestor Theme, in the node scope', () => {
    const leaf = solvedLeaf(
      [iconTheme({ CheckBox: { checked: 'ExtResource("1")' } })],
      checkBox({ checked: 'SubResource("Local")' })
    );
    expect(leaf.icons.checked?.ref).toBe('SubResource("Local")');
    expect(leaf.icons.checked?.resources).toBe(leaf.resources);
  });

  it("falls to the ancestor Theme without a local override, in that theme file's own scope", () => {
    const ancestor = iconTheme({ CheckBox: { checked: 'ExtResource("1")' } });
    const leaf = solvedLeaf([ancestor], checkBox());
    expect(leaf.icons.checked?.ref).toBe('ExtResource("1")');
    expect(leaf.icons.checked?.resources).toBe(ancestor.resources);
  });

  it('lets the nearest ancestor Theme win over a farther one (theme_owner.cpp:236-245)', () => {
    const farther = iconTheme({ CheckBox: { checked: 'ExtResource("farther")' } });
    const nearer = iconTheme({ CheckBox: { checked: 'ExtResource("nearer")' } });
    expect(solvedLeaf([farther, nearer], checkBox()).icons.checked?.ref).toBe('ExtResource("nearer")');
  });

  it('leaves a name absent, not null, when nothing in the chain resolves it', () => {
    const leaf = solvedLeaf([iconTheme({ CheckBox: { unchecked: 'ExtResource("1")' } })], checkBox());
    expect(Object.hasOwn(leaf.icons, 'checked')).toBe(false);
  });

  it('falls to the project theme when no ancestor Theme resolves the name', async () => {
    const files: Record<string, string> = {
      'res://project.godot': [
        'config_version=5',
        '',
        '[gui]',
        '',
        'theme/custom="res://project_theme.tres"',
        '',
      ].join('\n'),
      'res://project_theme.tres': [
        '[gd_resource type="Theme" load_steps=2 format=3]',
        '',
        '[ext_resource type="Texture2D" path="res://icon.png" id="1"]',
        '',
        '[resource]',
        'CheckBox/icons/checked = ExtResource("1")',
        '',
      ].join('\n'),
    };
    const loader = loaderServing(files);

    const { result } = renderHook(() => useBuildSolveTree([checkBox()], [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
        </ResourceLoaderProvider>
      ),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const checked = result.current.tree[0]!.icons.checked;
    expect(checked?.ref).toBe('ExtResource("1")');
    expect(checked?.resources.externalResources.map((r) => r.path)).toEqual(['res://icon.png']);
  });

  /** A ViewportTexture in an icon is set up only when every holder is local to scene (`core/io/resource.cpp:497-503`). */
  it('holds a local override icon through the node property alone', () => {
    const leaf = solvedLeaf([], checkBox({ checked: 'SubResource("Local")' }));
    expect(leaf.icons.checked?.holders).toEqual([]);
  });

  it('holds an ancestor Theme icon through that Theme, local to scene as the Theme says', () => {
    const icons = { CheckBox: { checked: 'ExtResource("1")' } };
    const shared = solvedLeaf([iconTheme(icons)], checkBox());
    const local = solvedLeaf(
      [themeResource({ ...iconTheme(icons), properties: { resource_local_to_scene: 'true' } })],
      checkBox()
    );
    expect([shared, local].map((leaf) => leaf.icons.checked?.holders.map(isLocalToScene))).toEqual([
      [false],
      [true],
    ]);
  });

  /** `ThemeDB::initialize_theme` loads the project theme outside every scene (`theme_db.cpp:53-80`). */
  it('holds a project theme icon through a Theme no scene sets up, whatever the file says', async () => {
    const loader = loaderServing({
      'res://project.godot': [
        'config_version=5',
        '',
        '[gui]',
        '',
        'theme/custom="res://project_theme.tres"',
        '',
      ].join('\n'),
      'res://project_theme.tres': [
        '[gd_resource type="Theme" format=3]',
        '',
        '[resource]',
        'resource_local_to_scene = true',
        'CheckBox/icons/checked = SubResource("Local")',
        '',
      ].join('\n'),
    });
    const { result } = renderHook(() => useBuildSolveTree([checkBox()], [], []), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={loader}>
          <ProjectSettingsProvider sceneKey="res://scene.tscn">{children}</ProjectSettingsProvider>
        </ResourceLoaderProvider>
      ),
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.tree[0]!.icons.checked?.holders.map(isLocalToScene)).toEqual([false]);
  });
});

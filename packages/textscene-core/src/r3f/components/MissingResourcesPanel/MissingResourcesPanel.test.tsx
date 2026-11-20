import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { resourcePipelineOf } from '../../sceneResourcePipeline';
import { filesOf, mountPanel, sceneReading } from './MissingResourcesPanel.testkit';

const ICON = 'res://icon.png';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

const missingRows = (panel: HTMLElement) =>
  [...panel.querySelectorAll('[data-state="missing"]')].map((row) => row.getAttribute('data-path'));

const WITH_ATLAS = `[gd_scene format=3]

[ext_resource type="Material" path="res://atlas.tres" id="1"]

[node name="Main" type="MeshInstance3D"]
material_override = ExtResource("1")
`;

const ATLAS = `[gd_resource type="StandardMaterial3D" format=3]

[ext_resource type="Texture2D" path="res://gone.png" id="1"]

[resource]
albedo_texture = ExtResource("1")
`;

const ATLAS_DECLARING_NOTHING = '[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n';

describe('<MissingResourcesPanel>', () => {
  it('shows one row for each missing file of the scene, by path', async () => {
    const { panel } = await mountPanel(sceneReading(['res://b.png', 'res://a.png']), filesOf({}));
    await waitFor(() => expect(missingRows(panel)).toEqual(['res://a.png', 'res://b.png']));
  });

  it('names the chain to the file that failed first, and hands the host that file', async () => {
    const { panel, onUpload } = await mountPanel(WITH_ATLAS, filesOf({ 'res://atlas.tres': ATLAS }));
    const row = await waitFor(() => {
      const atlas = panel.querySelector('[data-path="res://atlas.tres"]');
      expect(atlas?.querySelector('[data-testid="load-failure-chain"]')).not.toBeNull();
      return atlas!;
    });
    expect(row.querySelector('[data-testid="load-failure-chain"]')?.textContent).toBe(
      'Fails to load: res://atlas.tres → res://gone.png (missing)'
    );
    const file = new File(['bytes'], 'gone.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(row.querySelector('input[type="file"]')!, { target: { files: [file] } });
    });
    expect(onUpload).toHaveBeenCalledWith('res://gone.png', file);
  });

  it('names the sub-resource addresses the scene reads inside a missing file', async () => {
    const source = WITH_ATLAS.replace('path="res://atlas.tres"', 'path="res://atlas.tres::Material_1"');
    const { panel } = await mountPanel(source, filesOf({}));
    const addresses = await waitFor(() => {
      const found = panel.querySelector('[data-testid="missing-file-addresses"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(addresses.textContent).toBe('Asked inside it: res://atlas.tres::Material_1');
  });

  it('names each sub-resource address the file does not declare, as Godot gives each a row', async () => {
    const source = WITH_ATLAS.replace('path="res://atlas.tres"', 'path="res://atlas.tres::A"').replace(
      'material_override = ExtResource("1")',
      'material_override = ExtResource("1")\nmaterial_overlay = Resource("res://atlas.tres::B")'
    );
    const { panel } = await mountPanel(source, filesOf({ 'res://atlas.tres': ATLAS_DECLARING_NOTHING }));
    const undeclared = await waitFor(() => {
      const found = panel.querySelector('[data-testid="undeclared-addresses"]');
      expect(found).not.toBeNull();
      return found!;
    });
    expect(undeclared.textContent).toBe('Not declared inside it: res://atlas.tres::A, res://atlas.tres::B');
  });

  it('turns a missing row uploaded once its file loads, and forwards a Remove to the host', async () => {
    const files: Record<string, ArrayBuffer> = {};
    const { scene, panel, onRemove } = await mountPanel(sceneReading([ICON]), filesOf(files));
    await waitFor(() => expect(missingRows(panel)).toEqual([ICON]));
    files[ICON] = PNG;
    act(() => resourcePipelineOf(scene).loader.provideFile(ICON));
    const remove = await screen.findByRole('button', { name: `Remove uploaded file for ${ICON}` });
    expect(missingRows(screen.getByTestId('missing-resources-panel'))).toEqual([]);
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledWith(ICON);
    expect(screen.queryByTestId('missing-resources-panel')).toBeNull();
  });

  it('keeps an uploaded row after a new text stops naming its file, so the host can still remove it', async () => {
    const files: Record<string, ArrayBuffer> = {};
    const { scene, panel } = await mountPanel(sceneReading([ICON]), filesOf(files));
    await waitFor(() => expect(missingRows(panel)).toEqual([ICON]));
    files[ICON] = PNG;
    act(() => resourcePipelineOf(scene).loader.provideFile(ICON));
    await screen.findByRole('button', { name: `Remove uploaded file for ${ICON}` });
    act(() => scene.setSource(sceneReading([])));
    await waitFor(() => expect(scene.files().some((file) => file.path === ICON)).toBe(false));
    expect(screen.getByRole('button', { name: `Remove uploaded file for ${ICON}` })).not.toBeNull();
  });

  it('marks uploaded only the file that failed first, not the file that failed through it', async () => {
    const files: Record<string, string | ArrayBuffer> = { 'res://atlas.tres': ATLAS };
    const { scene } = await mountPanel(WITH_ATLAS, filesOf(files));
    await waitFor(() => expect(scene.files().map((file) => file.state)).toEqual(['missing', 'missing']));
    files['res://gone.png'] = PNG;
    act(() => resourcePipelineOf(scene).loader.provideFile('res://gone.png'));
    await screen.findByRole('button', { name: 'Remove uploaded file for res://gone.png' });
    await waitFor(() => expect(scene.files().every((file) => file.state === 'loaded')).toBe(true));
    expect(screen.queryByRole('button', { name: 'Remove uploaded file for res://atlas.tres' })).toBeNull();
  });

  it('keeps the panel on the page while an uploaded file loads again', async () => {
    const files: Record<string, ArrayBuffer> = {};
    const { scene, panel } = await mountPanel(sceneReading([ICON]), filesOf(files));
    await waitFor(() => expect(missingRows(panel)).toEqual([ICON]));
    let wasHidden = false;
    const observer = new MutationObserver(() => {
      wasHidden ||= screen.queryByTestId('missing-resources-panel') === null;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    files[ICON] = PNG;
    act(() => resourcePipelineOf(scene).loader.provideFile(ICON));
    await screen.findByRole('button', { name: `Remove uploaded file for ${ICON}` });
    observer.disconnect();
    expect(wasHidden).toBe(false);
  });

  it('shows no uploaded row for a file that loads on its first request', async () => {
    const { scene } = await mountPanel(sceneReading([ICON, 'res://gone.png']), filesOf({ [ICON]: PNG }));
    await waitFor(() => expect(scene.files().every((file) => file.state !== 'loading')).toBe(true));
    expect(screen.queryByRole('button', { name: /Remove uploaded file/ })).toBeNull();
  });
});

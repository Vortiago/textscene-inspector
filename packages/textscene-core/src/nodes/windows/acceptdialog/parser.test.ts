import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseDialog } from './parser';

function parse(properties: Record<string, string>) {
  return parseDialog(heading('AcceptDialog', { name: 'Dialog' }), properties);
}

describe('parseDialog', () => {
  it('reads the message and the OK text', () => {
    const dialog = parse({ dialog_text: '"Sure?"', ok_button_text: '"Yes"' });
    expect([dialog.dialog_text, dialog.ok_button_text]).toEqual(['Sure?', 'Yes']);
  });

  it('shows no message and "OK" by default', () => {
    const dialog = parse({});
    expect([dialog.dialog_text, dialog.ok_button_text]).toEqual(['', 'OK']);
  });

  it('shows "OK" for an empty OK text', () => {
    expect(parse({ ok_button_text: '""' }).ok_button_text).toBe('OK');
  });

  it('reads dialog_autowrap', () => {
    expect(parse({ dialog_autowrap: 'true' }).dialog_autowrap).toBe(true);
    expect(parse({}).dialog_autowrap).toBe(false);
  });

  it('caches the unwrapped message minimum when dialog_text follows visible with no size line between', () => {
    expect(parse({ visible: 'true', dialog_text: '"Hi"' }).has_unwrapped_message_minimum).toBe(true);
  });

  it.each(['dialog_autowrap = true', 'size = Vector2i(300, 100)', 'min_size = Vector2i(300, 100)'])(
    'wraps the message when %s comes before dialog_text',
    (line) => {
      const [key, value] = line.split(' = ') as [string, string];
      const properties = { visible: 'true', [key]: value, dialog_text: '"Hi"' };
      expect(parse(properties).has_unwrapped_message_minimum).toBe(false);
    }
  );

  it('keeps the unwrapped minimum through a min_size line that leaves min_size as it is', () => {
    const properties = { visible: 'true', min_size: 'Vector2i(0, 0)', dialog_text: '"Hi"' };
    expect(parse(properties).has_unwrapped_message_minimum).toBe(true);
  });

  it('keeps the unwrapped minimum through a max_size line that leaves max_size as it is', () => {
    const properties = { visible: 'true', max_size: 'Vector2i(0, 0)', dialog_text: '"Hi"' };
    expect(parse(properties).has_unwrapped_message_minimum).toBe(true);
  });

  it('wraps the message when a max_size line that changes max_size comes first', () => {
    const properties = { visible: 'true', max_size: 'Vector2i(400, 300)', dialog_text: '"Hi"' };
    expect(parse(properties).has_unwrapped_message_minimum).toBe(false);
  });

  it('wraps the message of a ConfirmationDialog, whose constructor sets min_size', () => {
    const properties = { visible: 'true', dialog_text: '"Hi"' };
    const confirmation = parseDialog(heading('ConfirmationDialog', { name: 'Dialog' }), properties);
    expect(confirmation.has_unwrapped_message_minimum).toBe(false);
  });

  it('wraps the message when dialog_text comes before visible, or the dialog is hidden', () => {
    expect(parse({ dialog_text: '"Hi"', visible: 'true' }).has_unwrapped_message_minimum).toBe(false);
    expect(parse({ dialog_text: '"Hi"' }).has_unwrapped_message_minimum).toBe(false);
  });
});

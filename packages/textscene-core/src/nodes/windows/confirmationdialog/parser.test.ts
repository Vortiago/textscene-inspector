import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseConfirmationDialog } from './parser';

function parse(properties: Record<string, string>) {
  return parseConfirmationDialog(heading('ConfirmationDialog', { name: 'Dialog' }), properties);
}

describe('parseConfirmationDialog', () => {
  it('reads cancel_button_text and the AcceptDialog keys', () => {
    const dialog = parse({ dialog_text: '"Sure?"', cancel_button_text: '"No"' });
    expect([dialog.dialog_text, dialog.cancel_button_text]).toEqual(['Sure?', 'No']);
  });

  it('shows "Cancel" by default', () => {
    expect(parse({}).cancel_button_text).toBe('Cancel');
  });

  it('keeps an empty Cancel text empty', () => {
    expect(parse({ cancel_button_text: '""' }).cancel_button_text).toBe('');
  });
});

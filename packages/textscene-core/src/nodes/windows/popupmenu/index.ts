/** PopupMenu parses as a Window plus its items. The linter's property knowledge lives in linterParser.ts. */
import { registerWindowParser } from '../window/registerWindowType';
import { parsePopupMenu } from './parser';

registerWindowParser('PopupMenu', parsePopupMenu);

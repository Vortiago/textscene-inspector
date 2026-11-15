/**
 * Godot's `XMLParser` (`core/io/xml_parser.cpp`) over a buffer it does not own (`_open_buffer`): a
 * pull parser that reads one node a call. It keeps Godot's quirks, as the SVG glyph hook reads
 * documents through it: a read never starts on the last byte, and a text, comment, CDATA or
 * definition node keeps the attributes of the element before it.
 */
import { xmlUnescape } from '../string/xmlUnescape';

/** `XMLParser::NodeType` (`core/io/xml_parser.h:46-54`). */
export const XmlNodeType = {
  NONE: 0,
  ELEMENT: 1,
  ELEMENT_END: 2,
  TEXT: 3,
  COMMENT: 4,
  CDATA: 5,
  UNKNOWN: 6,
} as const;

export type XmlNodeTypeValue = (typeof XmlNodeType)[keyof typeof XmlNodeType];

export interface XmlAttribute {
  readonly name: string;
  readonly value: string;
}

const LESS_THAN = 0x3c;
const GREATER_THAN = 0x3e;
const SLASH = 0x2f;
const EQUALS = 0x3d;
const QUESTION = 0x3f;
const EXCLAMATION = 0x21;
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const HYPHEN = 0x2d;
const DOUBLE_QUOTE = 0x22;
const SINGLE_QUOTE = 0x27;

/** `_is_white_space` (`xml_parser.cpp:37-39`). */
const isWhiteSpace = (byte: number): boolean =>
  byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/** Text of fewer bytes than this is reported only when it holds more than white space (`_set_text`). */
const SHORT_TEXT_BYTES = 3;

/** `CDATA[` and the `[` before it: the bytes `_parse_cdata` skips past the `!`. */
const CDATA_OPENING_BYTES = 8;

const utf8 = new TextDecoder();

export class XmlParser {
  /** `P`: the byte the next read starts at. */
  private at = 0;
  nodeType: XmlNodeTypeValue = XmlNodeType.NONE;
  /** The element's name, or the text of a text, comment, CDATA or definition node. */
  private name = '';
  /** Whether the element closes itself. */
  isEmpty = false;
  /** The byte the read of the current node started at, white space before it included. */
  nodeOffset = 0;
  attributes: XmlAttribute[] = [];

  constructor(private readonly data: Uint8Array) {}

  /** The name of the current node, or empty for a text node (`get_node_name`). */
  get nodeName(): string {
    return this.nodeType === XmlNodeType.TEXT ? '' : this.name;
  }

  /** The text of a text node, or empty for any other (`get_node_data`). */
  get nodeData(): string {
    return this.nodeType === XmlNodeType.TEXT ? this.name : '';
  }

  /** Reads the next node, or answers false at the end (`read`): a read never starts on the last byte. */
  read(): boolean {
    if (this.at >= this.data.length - 1 || this.byte(this.at) === 0) return false;
    this.parseCurrentNode();
    return true;
  }

  /** Reads the node at `offset`, or answers false for an offset past the end (`seek`). */
  seek(offset: number): boolean {
    if (offset >= this.data.length) return false;
    this.at = offset;
    return this.read();
  }

  hasAttribute(name: string): boolean {
    return this.attributes.some((attribute) => attribute.name === name);
  }

  /** The value of the attribute `name`, or empty where it has none. */
  namedAttributeValue(name: string): string {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? '';
  }

  /** Reads past the end of the current element (`skip_section`), unless it closes itself. */
  skipSection(): void {
    if (this.isEmpty) return;
    let depth = 1;
    while (depth && this.read()) {
      if (this.nodeType === XmlNodeType.ELEMENT && !this.isEmpty) depth++;
      else if (this.nodeType === XmlNodeType.ELEMENT_END) depth--;
    }
  }

  /** The byte at `at`, or 0 past the buffer, where Godot reads past an unterminated buffer. */
  private byte(at: number): number {
    return this.data[at] ?? 0;
  }

  private text(from: number, to: number): string {
    return utf8.decode(this.data.subarray(from, to));
  }

  /** Moves to the first byte `stop` accepts, or to the end. */
  private skipTo(stop: (byte: number) => boolean): void {
    while (this.byte(this.at) && !stop(this.byte(this.at))) this.at++;
  }

  /** `_parse_current_node` (`xml_parser.cpp:296-335`). */
  private parseCurrentNode(): void {
    const start = this.at;
    this.nodeOffset = start;
    this.skipTo((byte) => byte === LESS_THAN);
    if (this.at > start && this.setText(start, this.at)) return;
    if (!this.byte(this.at)) return;
    this.at++;
    switch (this.byte(this.at)) {
      case SLASH:
        this.parseClosingElement();
        break;
      case QUESTION:
        this.ignoreDefinition();
        break;
      case EXCLAMATION:
        if (!this.parseCdata()) this.parseComment();
        break;
      default:
        this.parseOpeningElement();
    }
  }

  /** `_set_text`: false for short text of white space alone, which is not reported. */
  private setText(from: number, to: number): boolean {
    if (to - from < SHORT_TEXT_BYTES) {
      let at = from;
      while (at !== to && isWhiteSpace(this.byte(at))) at++;
      if (at === to) return false;
    }
    this.name = xmlUnescape(this.text(from, to));
    this.nodeType = XmlNodeType.TEXT;
    return true;
  }

  private parseClosingElement(): void {
    this.nodeType = XmlNodeType.ELEMENT_END;
    this.isEmpty = false;
    this.attributes = [];
    this.at++;
    const begin = this.at;
    this.skipTo((byte) => byte === GREATER_THAN);
    this.name = this.text(begin, this.at);
    if (this.byte(this.at)) this.at++;
  }

  private ignoreDefinition(): void {
    this.nodeType = XmlNodeType.UNKNOWN;
    const begin = this.at;
    this.skipTo((byte) => byte === GREATER_THAN);
    this.name = this.text(begin, this.at);
    if (this.byte(this.at)) this.at++;
  }

  private parseCdata(): boolean {
    if (this.byte(this.at + 1) !== OPEN_BRACKET) return false;
    this.nodeType = XmlNodeType.CDATA;
    for (let count = 0; this.byte(this.at) && count < CDATA_OPENING_BYTES; count++) this.at++;
    if (!this.byte(this.at)) {
      this.name = '';
      return true;
    }
    const begin = this.at;
    let end = -1;
    while (this.byte(this.at) && end < 0) {
      const closes =
        this.byte(this.at) === GREATER_THAN &&
        this.byte(this.at - 1) === CLOSE_BRACKET &&
        this.byte(this.at - 2) === CLOSE_BRACKET;
      if (closes) end = this.at - 2;
      this.at++;
    }
    this.name = this.text(begin, end < 0 ? this.at : end);
    return true;
  }

  private parseComment(): void {
    this.nodeType = XmlNodeType.COMMENT;
    this.at++;
    const length = this.data.length;
    let begin: number;
    let end: number;
    if (this.at + 1 < length && this.byte(this.at) === HYPHEN && this.byte(this.at + 1) === HYPHEN) {
      begin = this.at + 2;
      for (end = begin; end + 2 < length; end++) {
        if (this.byte(end) === HYPHEN && this.byte(end + 1) === HYPHEN && this.byte(end + 2) === GREATER_THAN)
          break;
      }
      if (end + 2 < length) this.at = end + 3;
      else this.at = end = length;
    } else {
      // A document type definition: match the angle brackets.
      begin = this.at;
      let depth = 1;
      while (this.byte(this.at) && depth) {
        if (this.byte(this.at) === GREATER_THAN) depth--;
        else if (this.byte(this.at) === LESS_THAN) depth++;
        this.at++;
      }
      end = depth ? this.at : this.at - 1;
    }
    this.name = this.text(begin, end);
  }

  /** `_parse_opening_xml_element` (`xml_parser.cpp:197-291`). */
  private parseOpeningElement(): void {
    this.nodeType = XmlNodeType.ELEMENT;
    this.isEmpty = false;
    this.attributes = [];
    const nameBegin = this.at;
    this.skipTo((byte) => byte === GREATER_THAN || isWhiteSpace(byte));
    let nameEnd = this.at;
    while (this.byte(this.at) && this.byte(this.at) !== GREATER_THAN) {
      if (isWhiteSpace(this.byte(this.at))) {
        this.at++;
      } else if (this.byte(this.at) === SLASH) {
        this.at++;
        this.isEmpty = true;
        break;
      } else if (!this.readAttribute()) {
        break;
      }
    }
    if (nameEnd > nameBegin && this.byte(nameEnd - 1) === SLASH) {
      this.isEmpty = true;
      nameEnd--;
    }
    this.name = this.text(nameBegin, nameEnd);
    if (this.byte(this.at)) this.at++;
  }

  /** Reads one attribute, or answers false at a malformed end of input. */
  private readAttribute(): boolean {
    const nameBegin = this.at;
    this.skipTo((byte) => isWhiteSpace(byte) || byte === EQUALS);
    if (!this.byte(this.at)) return false;
    const nameEnd = this.at;
    this.at++;
    this.skipTo((byte) => byte === DOUBLE_QUOTE || byte === SINGLE_QUOTE);
    if (!this.byte(this.at)) return false;
    const quote = this.byte(this.at);
    this.at++;
    const valueBegin = this.at;
    this.skipTo((byte) => byte === quote);
    const valueEnd = this.at;
    if (this.byte(this.at)) this.at++;
    this.attributes.push({
      name: this.text(nameBegin, nameEnd),
      value: xmlUnescape(this.text(valueBegin, valueEnd)),
    });
    return true;
  }
}

import { CSSProperties } from "react";

export interface StyleRange {
  style:
    | "bold"
    | "italic"
    | "underline"
    | "strikethrough"
    | "link"
    | "code"
    | "highlight";
  start: number;
  end: number;
  url?: string;
  highlightColor?: string;
}

export type BlockType =
  | "paragraph"
  | "bullet"
  | "numbered"
  | "heading"
  | "quote"
  | "checklist"
  | "mediaAttachment";

export interface MediaAttachment {
  kind: "image" | "video";
  uri: string;
  width?: number;
  height?: number;
  alt?: string;
}

export type TextAlignment = "left" | "center" | "right";

export type EditorVariant = "outlined" | "flat" | "plain";

export interface Block {
  type: BlockType;
  text: string;
  styles: StyleRange[];
  alignment?: TextAlignment;
  checked?: boolean;
  indentLevel?: number;
  mediaAttachment?: MediaAttachment;
}

export interface ContentChangeEvent {
  text: string;
  blocks: Block[];
  delta?: ContentDelta;
}

export type DeltaType = "insert" | "delete" | "format" | "replace";

export interface ContentDelta {
  type: DeltaType;
  position: number;
  length?: number;
  text?: string;
  blockIndex?: number;
  style?: string;
}

export interface SelectionChangeEvent {
  start: number;
  end: number;
}

export type ToolbarOption =
  | "bold"
  | "italic"
  | "strikethrough"
  | "underline"
  | "code"
  | "highlight"
  | "heading"
  | "bullet"
  | "numbered"
  | "quote"
  | "checklist"
  | "mediaAttachment"
  | "link"
  | "undo"
  | "redo"
  | "clearFormatting"
  | "indent"
  | "outdent"
  | "alignLeft"
  | "alignCenter"
  | "alignRight";

export const DEFAULT_TOOLBAR_OPTIONS: ToolbarOption[] = [
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "code",
  "highlight",
  "heading",
  "bullet",
  "numbered",
  "quote",
  "checklist",
  "mediaAttachment",
  "link",
  "undo",
  "redo",
  "clearFormatting",
  "indent",
  "outdent",
  "alignLeft",
  "alignCenter",
  "alignRight",
];

export interface ActiveStylesState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  highlight: boolean;
  blockType: string;
  alignment: string;
}

export interface RichTextEditorProps {
  style?: CSSProperties;
  className?: string;
  placeholder?: string;
  initialContent?: Block[];
  readOnly?: boolean;
  numberOfLines?: number;
  maxHeight?: number;
  showToolbar?: boolean;
  toolbarOptions?: ToolbarOption[];
  variant?: EditorVariant;
  onContentChange?: (event: ContentChangeEvent) => void;
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onActiveStylesChange?: (styles: ActiveStylesState) => void;
}

export interface RichTextEditorRef {
  setContent: (blocks: Block[]) => void;
  getText: () => Promise<string>;
  getBlocks: () => Promise<Block[]>;
  clear: () => void;
  focus: () => void;
  blur: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrikethrough: () => void;
  toggleCode: () => void;
  toggleHighlight: (color?: string) => void;
  setHeading: () => void;
  setBulletList: () => void;
  setNumberedList: () => void;
  setQuote: () => void;
  setChecklist: () => void;
  setParagraph: () => void;
  insertLink: (url: string, text: string) => void;
  insertMediaAttachment: (mediaAttachment: MediaAttachment) => void;
  undo: () => void;
  redo: () => void;
  clearFormatting: () => void;
  indent: () => void;
  outdent: () => void;
  setAlignment: (alignment: TextAlignment) => void;
  toggleChecklistItem: () => void;
}

import { CSSProperties } from 'react';

/**
 * Represents an inline style range within a block of text.
 * Defines which characters (start to end) have a particular style applied.
 */
export interface StyleRange {
  /** The type of inline style */
  style: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'code' | 'highlight';
  /** Start index of the styled range (inclusive) */
  start: number;
  /** End index of the styled range (exclusive) */
  end: number;
  /** URL for link-type styles */
  url?: string;
  /** Custom highlight color (e.g., 'rgba(255, 255, 0, 0.5)') */
  highlightColor?: string;
}

/** Supported block types in the editor */
export type BlockType = 'paragraph' | 'bullet' | 'numbered' | 'heading' | 'quote' | 'checklist';

/** Text alignment options */
export type TextAlignment = 'left' | 'center' | 'right';

/** Editor container style variant */
export type EditorVariant = 'outlined' | 'flat';

/**
 * Represents a single content block in the editor.
 * The editor content is modeled as an array of blocks, each with its own type,
 * text content, and inline styles.
 */
export interface Block {
  /** The block type (paragraph, bullet, numbered, heading, quote, checklist) */
  type: BlockType;
  /** Plain text content of the block */
  text: string;
  /** Inline style ranges applied to the text */
  styles: StyleRange[];
  /** Text alignment for this block */
  alignment?: TextAlignment;
  /** Whether a checklist item is checked (only for checklist blocks) */
  checked?: boolean;
  /** Indent level for nested content */
  indentLevel?: number;
}

/**
 * Event emitted when the editor content changes.
 * Contains the full content (text + blocks) and an optional delta
 * describing only what changed for optimized processing.
 */
export interface ContentChangeEvent {
  /** Full plain text content of the editor */
  text: string;
  /** Parsed content blocks */
  blocks: Block[];
  /** Delta describing the specific change (insert, delete, replace, format) */
  delta?: ContentDelta;
}

/** Types of content changes */
export type DeltaType = 'insert' | 'delete' | 'format' | 'replace';

/**
 * Describes a specific content change (delta) for optimized processing.
 * Instead of sending the entire document, deltas describe only what changed.
 *
 * - **insert**: User typed text — includes `position` and `text`
 * - **delete**: User deleted text — includes `position` and `length`
 * - **replace**: Selection was replaced — includes `position`, `length`, and `text`
 * - **format**: Style was applied — includes `position` and `style`
 */
export interface ContentDelta {
  /** Type of change */
  type: DeltaType;
  /** Character position where the change occurred */
  position: number;
  /** Number of characters affected (for delete/replace) */
  length?: number;
  /** Inserted or replacement text (for insert/replace) */
  text?: string;
  /** Block index affected */
  blockIndex?: number;
  /** Style that was applied (for format deltas) */
  style?: string;
}

/**
 * Event emitted when the text selection changes.
 * Provides the start and end offsets of the current selection.
 */
export interface SelectionChangeEvent {
  /** Start offset of the selection */
  start: number;
  /** End offset of the selection (same as start if cursor, different if range) */
  end: number;
}

/**
 * Available toolbar button options.
 * Pass a subset of these to the `toolbarOptions` prop to customize the floating toolbar.
 */
export type ToolbarOption =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'underline'
  | 'code'
  | 'highlight'
  | 'heading'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'checklist'
  | 'link'
  | 'undo'
  | 'redo'
  | 'clearFormatting'
  | 'indent'
  | 'outdent'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight';

/** Default toolbar options — includes all available formatting actions */
export const DEFAULT_TOOLBAR_OPTIONS: ToolbarOption[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'highlight',
  'heading',
  'bullet',
  'numbered',
  'quote',
  'checklist',
  'link',
  'undo',
  'redo',
  'clearFormatting',
  'indent',
  'outdent',
  'alignLeft',
  'alignCenter',
  'alignRight',
];

/**
 * Current active styles at the cursor position.
 * Emitted via `onActiveStylesChange` whenever the selection or formatting changes.
 */
export interface ActiveStylesState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
  highlight: boolean;
  /** Current block type at cursor (e.g., 'paragraph', 'heading', 'bullet') */
  blockType: string;
  /** Current text alignment at cursor (e.g., 'left', 'center', 'right') */
  alignment: string;
}

/**
 * Props for the RichTextEditor component.
 *
 * @example
 * ```tsx
 * <RichTextEditor
 *   placeholder="Start typing..."
 *   variant="outlined"
 *   toolbarOptions={['bold', 'italic', 'underline', 'heading', 'bullet']}
 *   onContentChange={(event) => console.log(event.blocks)}
 * />
 * ```
 */
export interface RichTextEditorProps {
  /** Custom CSS styles for the editor container */
  style?: CSSProperties;
  /** Custom CSS class name for the editor container */
  className?: string;
  /** Placeholder text shown when the editor is empty */
  placeholder?: string;
  /** Initial content blocks to populate the editor */
  initialContent?: Block[];
  /** Make the editor read-only (disables editing and toolbar) */
  readOnly?: boolean;
  /** Maximum height in pixels before the editor scrolls */
  maxHeight?: number;
  /** Show or hide the floating toolbar on text selection (default: true) */
  showToolbar?: boolean;
  /** Customize which buttons appear in the floating toolbar */
  toolbarOptions?: ToolbarOption[];
  /** Editor style variant: 'outlined' (border + rounded) or 'flat' (bottom border only) */
  variant?: EditorVariant;
  /** Called when the editor content changes, with full content and delta */
  onContentChange?: (event: ContentChangeEvent) => void;
  /** Called when the text selection changes */
  onSelectionChange?: (event: SelectionChangeEvent) => void;
  /** Called when the editor gains focus */
  onFocus?: () => void;
  /** Called when the editor loses focus */
  onBlur?: () => void;
  /** Called when the active styles at the cursor position change */
  onActiveStylesChange?: (styles: ActiveStylesState) => void;
}

/**
 * Imperative methods exposed via ref for programmatic control of the editor.
 *
 * @example
 * ```tsx
 * const editorRef = useRef<RichTextEditorRef>(null);
 *
 * // Apply bold to selection
 * editorRef.current?.toggleBold();
 *
 * // Get current content
 * const blocks = await editorRef.current?.getBlocks();
 * ```
 */
export interface RichTextEditorRef {
  /** Replace the entire editor content with the given blocks */
  setContent: (blocks: Block[]) => void;
  /** Get the full plain text content */
  getText: () => Promise<string>;
  /** Get the parsed content blocks */
  getBlocks: () => Promise<Block[]>;
  /** Clear all editor content */
  clear: () => void;
  /** Focus the editor */
  focus: () => void;
  /** Blur (unfocus) the editor */
  blur: () => void;
  /** Toggle bold on the current selection */
  toggleBold: () => void;
  /** Toggle italic on the current selection */
  toggleItalic: () => void;
  /** Toggle underline on the current selection */
  toggleUnderline: () => void;
  /** Toggle strikethrough on the current selection */
  toggleStrikethrough: () => void;
  /** Toggle inline code on the current selection */
  toggleCode: () => void;
  /** Toggle highlight on the current selection */
  toggleHighlight: (color?: string) => void;
  /** Toggle heading (h2) on the current block */
  setHeading: () => void;
  /** Convert the current block to a bullet list item */
  setBulletList: () => void;
  /** Convert the current block to a numbered list item */
  setNumberedList: () => void;
  /** Convert the current block to a blockquote */
  setQuote: () => void;
  /** Convert the current block to a checklist item */
  setChecklist: () => void;
  /** Convert the current block to a plain paragraph */
  setParagraph: () => void;
  /** Insert a hyperlink at the current cursor position or selection */
  insertLink: (url: string, text: string) => void;
  /** Undo the last action */
  undo: () => void;
  /** Redo the last undone action */
  redo: () => void;
  /** Remove all inline formatting from the current selection */
  clearFormatting: () => void;
  /** Indent the current block */
  indent: () => void;
  /** Outdent the current block */
  outdent: () => void;
  /** Set text alignment for the current block */
  setAlignment: (alignment: TextAlignment) => void;
  /** Toggle the checked state of the current checklist item */
  toggleChecklistItem: () => void;
}

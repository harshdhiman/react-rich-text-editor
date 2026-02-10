/**
 * @chaitrabhairappa/react-rich-text-editor
 *
 * A powerful rich text editor for React (web) with a floating toolbar,
 * block-based content model, and delta-based change tracking.
 * Matches the design and behavior of @chaitrabhairappa/react-native-rich-text-editor.
 */

// Default export — the main editor component
export { default as default } from './RichTextEditor';

// Named exports — component and toolbar
export { default as RichTextEditor } from './RichTextEditor';
export { FloatingToolbar } from './FloatingToolbar';

// Constants
export { DEFAULT_TOOLBAR_OPTIONS } from './types';

// Type exports
export type {
  Block,
  BlockType,
  StyleRange,
  TextAlignment,
  EditorVariant,
  ContentChangeEvent,
  SelectionChangeEvent,
  RichTextEditorRef,
  RichTextEditorProps,
  ToolbarOption,
  ContentDelta,
  DeltaType,
  ActiveStylesState,
} from './types';

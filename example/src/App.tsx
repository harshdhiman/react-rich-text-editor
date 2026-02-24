import { useRef } from 'react';
import RichTextEditor from '@chaitrabhairappa/react-rich-text-editor';
import type {
  RichTextEditorRef,
  ContentChangeEvent,
  Block,
} from '@chaitrabhairappa/react-rich-text-editor';

const sampleContent: Block[] = [
  {
    type: 'paragraph',
    text: 'This is a rich text editor demo with multiple lines of content that should be truncated when displayed in read-only mode with numberOfLines set.',
    styles: [{ style: 'bold', start: 0, end: 4 }],
  },
  {
    type: 'numbered',
    text: 'First numbered item with bold text',
    styles: [{ style: 'bold', start: 26, end: 35 }],
  },
  {
    type: 'bullet',
    text: 'Second bullet item with italic dhdhdhdhhdhdhdhhd hdhdhdhd dgdgdgd yydyd hddhdhdh ddgdggd dgdgdg dgdgdg dgdgdg',
    styles: [{ style: 'italic', start: 24, end: 30 }],
  },
  {
    type: 'numbered',
    text: 'First numbered item',
    styles: [{ style: 'underline', start: 0, end: 5 }],
  },
  {
    type: 'numbered',
    text: 'Second numbered item with strikethrough',
    styles: [{ style: 'strikethrough', start: 25, end: 38 }],
  },
  {
    type: 'paragraph',
    text: 'This second paragraph adds more content to demonstrate the ellipsis truncation behavior.',
    styles: [{ style: 'italic', start: 5, end: 11 }],
  },
  {
    type: 'paragraph',
    text: 'This third paragraph should not be visible at all when numberOfLines is set.',
    styles: [],
  },
];

function App() {
  const editorRef = useRef<RichTextEditorRef>(null);

  const handleContentChange = (event: ContentChangeEvent) => {
    console.log('Content changed:', event.text);
  };

  return (
    <div
      style={{
        width: '100%',
        padding: 16,
        fontFamily: 'sans-serif',
      }}
    >
      <h2 style={{ textAlign: 'center' }}>Rich Text Editor Demo</h2>

      <p style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>
        Read-Only with numberOfLines=4:
      </p>
      <RichTextEditor initialContent={sampleContent} readOnly variant="flat" numberOfLines={2} />

      <p style={{ fontSize: 14, fontWeight: 600, color: '#666', marginTop: 24 }}>
        Editable Editor:
      </p>
      <RichTextEditor
        ref={editorRef}
        placeholder="Start typing..."
        onContentChange={handleContentChange}
        variant="outlined"
        maxHeight={1000}
      />
    </div>
  );
}

export default App;

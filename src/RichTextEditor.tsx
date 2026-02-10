import React, {
  forwardRef,
  useRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
} from 'react';
import {
  RichTextEditorProps,
  RichTextEditorRef,
  Block,
  BlockType,
  StyleRange,
  ActiveStylesState,
  TextAlignment,
  ContentChangeEvent,
  ContentDelta,
  ToolbarOption,
  DEFAULT_TOOLBAR_OPTIONS,
} from './types';
import { FloatingToolbar } from './FloatingToolbar';

// ===================== DOM Utilities =====================
// These functions handle parsing the contentEditable DOM into structured Block data
// and converting Block data back into HTML for the editor.

/** Extracts plain text and inline style ranges from a DOM element by walking its children. */
function extractInlineStyles(element: HTMLElement): { text: string; styles: StyleRange[] } {
  let text = '';
  const styles: StyleRange[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const start = text.length;

      for (let i = 0; i < el.childNodes.length; i++) {
        walk(el.childNodes[i]);
      }

      const end = text.length;
      if (start < end) {
        if (tag === 'b' || tag === 'strong') {
          styles.push({ style: 'bold', start, end });
        }
        if (tag === 'i' || tag === 'em') {
          styles.push({ style: 'italic', start, end });
        }
        if (tag === 'u') {
          styles.push({ style: 'underline', start, end });
        }
        if (tag === 's' || tag === 'strike' || tag === 'del') {
          styles.push({ style: 'strikethrough', start, end });
        }
        if (tag === 'code') {
          styles.push({ style: 'code', start, end });
        }
        if (tag === 'mark') {
          styles.push({ style: 'highlight', start, end });
        }
        if (tag === 'a') {
          styles.push({ style: 'link', start, end, url: el.getAttribute('href') || '' });
        }
        // Handle span-based styles (some browsers use spans)
        if (tag === 'span') {
          const cs = el.style;
          if (cs.fontWeight === 'bold' || parseInt(cs.fontWeight) >= 700) {
            styles.push({ style: 'bold', start, end });
          }
          if (cs.fontStyle === 'italic') {
            styles.push({ style: 'italic', start, end });
          }
          if (cs.textDecoration?.includes('underline') || cs.textDecorationLine?.includes('underline')) {
            styles.push({ style: 'underline', start, end });
          }
          if (cs.textDecoration?.includes('line-through') || cs.textDecorationLine?.includes('line-through')) {
            styles.push({ style: 'strikethrough', start, end });
          }
          if (cs.backgroundColor && cs.backgroundColor !== 'transparent' && cs.backgroundColor !== '') {
            const bg = cs.backgroundColor.toLowerCase();
            if (bg.includes('yellow') || bg.includes('255, 255, 0') || bg.includes('ffff00')) {
              styles.push({ style: 'highlight', start, end });
            }
          }
          if (cs.fontFamily?.includes('monospace')) {
            styles.push({ style: 'code', start, end });
          }
        }
      }
    }
  }

  for (let i = 0; i < element.childNodes.length; i++) {
    walk(element.childNodes[i]);
  }

  return { text, styles };
}

/** Parses the editor's DOM children into an array of structured Block objects. */
function parseBlocksFromDOM(editor: HTMLElement): Block[] {
  const blocks: Block[] = [];

  function processElement(el: HTMLElement) {
    const tag = el.tagName.toLowerCase();

    // Handle list containers
    if (tag === 'ul') {
      for (let i = 0; i < el.children.length; i++) {
        const li = el.children[i] as HTMLElement;
        if (li.tagName.toLowerCase() === 'li') {
          const { text, styles } = extractInlineStyles(li);
          const alignment = getElementAlignment(li);
          blocks.push({ type: 'bullet', text, styles, alignment });
        }
      }
      return;
    }
    if (tag === 'ol') {
      for (let i = 0; i < el.children.length; i++) {
        const li = el.children[i] as HTMLElement;
        if (li.tagName.toLowerCase() === 'li') {
          const { text, styles } = extractInlineStyles(li);
          const alignment = getElementAlignment(li);
          blocks.push({ type: 'numbered', text, styles, alignment });
        }
      }
      return;
    }

    // Headings
    if (/^h[1-6]$/.test(tag)) {
      const { text, styles } = extractInlineStyles(el);
      const alignment = getElementAlignment(el);
      blocks.push({ type: 'heading', text, styles, alignment });
      return;
    }

    // Blockquote
    if (tag === 'blockquote') {
      const { text, styles } = extractInlineStyles(el);
      const alignment = getElementAlignment(el);
      blocks.push({ type: 'quote', text, styles, alignment });
      return;
    }

    // Checklist items
    if (el.dataset.type === 'checklist') {
      const checked = el.dataset.checked === 'true';
      const textEl = el.querySelector('[data-checklist-text]') as HTMLElement;
      if (textEl) {
        const { text, styles } = extractInlineStyles(textEl);
        const alignment = getElementAlignment(el);
        blocks.push({ type: 'checklist', text, styles, alignment, checked });
      } else {
        const { text, styles } = extractInlineStyles(el);
        const alignment = getElementAlignment(el);
        blocks.push({ type: 'checklist', text, styles, alignment, checked });
      }
      return;
    }

    // Default: paragraph (div, p, or other block elements)
    if (tag === 'p' || tag === 'div' || tag === 'br') {
      if (tag === 'br') {
        blocks.push({ type: 'paragraph', text: '', styles: [] });
        return;
      }
      // Skip empty divs that are just containers
      const { text, styles } = extractInlineStyles(el);
      const alignment = getElementAlignment(el);
      blocks.push({ type: 'paragraph', text, styles, alignment });
      return;
    }
  }

  if (editor.childNodes.length === 0) {
    const text = editor.textContent || '';
    if (text) {
      blocks.push({ type: 'paragraph', text, styles: [] });
    }
    return blocks;
  }

  for (let i = 0; i < editor.childNodes.length; i++) {
    const node = editor.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text && text !== '\n') {
        blocks.push({ type: 'paragraph', text, styles: [] });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      processElement(node as HTMLElement);
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'paragraph', text: '', styles: [] });
  }

  return blocks;
}

function getElementAlignment(el: HTMLElement): TextAlignment | undefined {
  const align = el.style.textAlign;
  if (align === 'center') return 'center';
  if (align === 'right') return 'right';
  if (align === 'left') return 'left';
  return undefined;
}

/** Converts an array of Block objects back into HTML for the contentEditable editor. */
function blocksToHTML(blocks: Block[]): string {
  let html = '';
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const alignStyle = block.alignment ? ` style="text-align: ${block.alignment}"` : '';

    switch (block.type) {
      case 'heading':
        html += `<h2${alignStyle}>${applyStylesToText(block.text, block.styles)}</h2>`;
        i++;
        break;

      case 'bullet': {
        html += '<ul>';
        while (i < blocks.length && blocks[i].type === 'bullet') {
          const b = blocks[i];
          const as = b.alignment ? ` style="text-align: ${b.alignment}"` : '';
          html += `<li${as}>${applyStylesToText(b.text, b.styles)}</li>`;
          i++;
        }
        html += '</ul>';
        break;
      }

      case 'numbered': {
        html += '<ol>';
        while (i < blocks.length && blocks[i].type === 'numbered') {
          const b = blocks[i];
          const as = b.alignment ? ` style="text-align: ${b.alignment}"` : '';
          html += `<li${as}>${applyStylesToText(b.text, b.styles)}</li>`;
          i++;
        }
        html += '</ol>';
        break;
      }

      case 'quote':
        html += `<blockquote${alignStyle}>${applyStylesToText(block.text, block.styles)}</blockquote>`;
        i++;
        break;

      case 'checklist': {
        const checked = block.checked ? 'true' : 'false';
        const checkbox = block.checked ? '&#9745; ' : '&#9744; ';
        html += `<div data-type="checklist" data-checked="${checked}"${alignStyle}>${checkbox}<span data-checklist-text="">${applyStylesToText(block.text, block.styles)}</span></div>`;
        i++;
        break;
      }

      case 'paragraph':
      default:
        html += `<div${alignStyle}>${applyStylesToText(block.text, block.styles) || '<br>'}</div>`;
        i++;
        break;
    }
  }

  return html;
}

function applyStylesToText(text: string, styles: StyleRange[]): string {
  if (!text) return '';
  if (styles.length === 0) return escapeHTML(text);

  // Sort styles by start position
  const sorted = [...styles].sort((a, b) => a.start - b.start || b.end - a.end);

  // Build character-level style map
  const chars: { char: string; tags: string[] }[] = [];
  for (let i = 0; i < text.length; i++) {
    chars.push({ char: text[i], tags: [] });
  }

  for (const style of sorted) {
    const start = Math.max(0, style.start);
    const end = Math.min(text.length, style.end);
    for (let i = start; i < end; i++) {
      switch (style.style) {
        case 'bold': chars[i].tags.push('strong'); break;
        case 'italic': chars[i].tags.push('em'); break;
        case 'underline': chars[i].tags.push('u'); break;
        case 'strikethrough': chars[i].tags.push('s'); break;
        case 'code': chars[i].tags.push('code'); break;
        case 'highlight': chars[i].tags.push('mark'); break;
        case 'link': chars[i].tags.push(`a:${style.url || ''}`); break;
      }
    }
  }

  // Group consecutive characters with same tags
  let result = '';
  let currentTags: string[] = [];
  let currentText = '';

  const tagsKey = (tags: string[]) => tags.join(',');

  for (let i = 0; i < chars.length; i++) {
    const charTags = [...new Set(chars[i].tags)].sort();
    if (tagsKey(charTags) === tagsKey(currentTags)) {
      currentText += chars[i].char;
    } else {
      if (currentText) {
        result += wrapWithTags(escapeHTML(currentText), currentTags);
      }
      currentTags = charTags;
      currentText = chars[i].char;
    }
  }
  if (currentText) {
    result += wrapWithTags(escapeHTML(currentText), currentTags);
  }

  return result;
}

function wrapWithTags(text: string, tags: string[]): string {
  let result = text;
  for (const tag of tags) {
    if (tag.startsWith('a:')) {
      const url = tag.slice(2);
      result = `<a href="${escapeAttr(url)}" style="color:#2196F3;text-decoration:underline">${result}</a>`;
    } else {
      result = `<${tag}>${result}</${tag}>`;
    }
  }
  return result;
}

function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===================== Active Styles Detection =====================
// Detects which formatting styles are currently active at the cursor position
// by walking up the DOM tree from the selection anchor and checking tags/computed styles.

function detectActiveStyles(editor: HTMLElement): ActiveStylesState {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return defaultActiveStyles();
  }

  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    return defaultActiveStyles();
  }

  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let code = false;
  let highlight = false;
  let blockType: string = 'paragraph';
  let alignment: string = 'left';

  // Walk up from cursor/selection to check inline styles
  let node: Node | null = range.startContainer;
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === 'b' || tag === 'strong') bold = true;
      if (tag === 'i' || tag === 'em') italic = true;
      if (tag === 'u') underline = true;
      if (tag === 's' || tag === 'strike' || tag === 'del') strikethrough = true;
      if (tag === 'code') code = true;
      if (tag === 'mark') highlight = true;

      // Check span styles
      if (tag === 'span') {
        const cs = el.style;
        if (cs.fontWeight === 'bold' || parseInt(cs.fontWeight) >= 700) bold = true;
        if (cs.fontStyle === 'italic') italic = true;
        if (cs.textDecoration?.includes('underline') || cs.textDecorationLine?.includes('underline')) underline = true;
        if (cs.textDecoration?.includes('line-through') || cs.textDecorationLine?.includes('line-through')) strikethrough = true;
        if (cs.fontFamily?.includes('monospace')) code = true;
        if (cs.backgroundColor) {
          const bg = cs.backgroundColor.toLowerCase();
          if (bg.includes('yellow') || bg.includes('255, 255, 0') || bg.includes('ffff00')) {
            highlight = true;
          }
        }
      }

      // Block type detection
      if (/^h[1-6]$/.test(tag)) blockType = 'heading';
      if (tag === 'blockquote') blockType = 'quote';
      if (tag === 'li') {
        const parent = el.parentElement;
        if (parent) {
          const ptag = parent.tagName.toLowerCase();
          if (ptag === 'ul') blockType = 'bullet';
          if (ptag === 'ol') blockType = 'numbered';
        }
      }
      if (el.dataset.type === 'checklist') blockType = 'checklist';

      // Alignment
      if (el.style.textAlign) {
        alignment = el.style.textAlign;
      }
    }
    node = node.parentNode;
  }

  // Also check computed style for bold/italic
  const computed = window.getComputedStyle(range.startContainer.parentElement || editor);
  if (!bold && (computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 700)) {
    bold = true;
  }
  if (!italic && computed.fontStyle === 'italic') {
    italic = true;
  }

  return { bold, italic, underline, strikethrough, code, highlight, blockType, alignment };
}

function defaultActiveStyles(): ActiveStylesState {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    code: false,
    highlight: false,
    blockType: 'paragraph',
    alignment: 'left',
  };
}

// ===================== Editor Component =====================

/**
 * A rich text editor component built with contentEditable.
 * Provides a floating toolbar for text formatting, block-based content model,
 * delta-based change tracking, and a full imperative API via ref.
 *
 * Designed to match the design and behavior of @chaitrabhairappa/react-native-rich-text-editor.
 */
const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>((props, ref) => {
  const {
    style,
    className,
    placeholder = '',
    initialContent,
    readOnly = false,
    maxHeight,
    showToolbar = true,
    toolbarOptions = DEFAULT_TOOLBAR_OPTIONS,
    variant = 'outlined',
    onContentChange,
    onSelectionChange,
    onFocus,
    onBlur,
    onActiveStylesChange,
  } = props;

  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const isFocusedRef = useRef(false);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [activeStyles, setActiveStyles] = useState<ActiveStylesState>(defaultActiveStyles());
  const previousTextRef = useRef('');
  const isInternalChangeRef = useRef(false);
  const hideToolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== Initialize content =====
  useEffect(() => {
    if (initialContent && initialContent.length > 0 && editorRef.current) {
      isInternalChangeRef.current = true;
      editorRef.current.innerHTML = blocksToHTML(initialContent);
      setIsEmpty(false);
      isInternalChangeRef.current = false;
      previousTextRef.current = editorRef.current.innerText;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Content change handler =====
  const emitContentChange = useCallback((delta?: ContentDelta) => {
    if (!editorRef.current || !onContentChange) return;

    const text = editorRef.current.innerText || '';
    const blocks = parseBlocksFromDOM(editorRef.current);

    const event: ContentChangeEvent = { text, blocks };
    if (delta) {
      event.delta = delta;
    }

    onContentChange(event);
    previousTextRef.current = text;
  }, [onContentChange]);

  // ===== Input handler =====
  const handleInput = useCallback(() => {
    if (isInternalChangeRef.current) return;

    const editor = editorRef.current;
    if (!editor) return;

    const newText = editor.innerText || '';
    const prevText = previousTextRef.current;

    setIsEmpty(!newText || newText === '\n');

    // Compute delta
    let delta: ContentDelta | undefined;
    if (newText.length > prevText.length) {
      // Insert
      const diffLen = newText.length - prevText.length;
      let pos = 0;
      while (pos < prevText.length && prevText[pos] === newText[pos]) pos++;
      delta = {
        type: 'insert',
        position: pos,
        text: newText.substring(pos, pos + diffLen),
      };
    } else if (newText.length < prevText.length) {
      // Delete
      const diffLen = prevText.length - newText.length;
      let pos = 0;
      while (pos < newText.length && prevText[pos] === newText[pos]) pos++;
      delta = {
        type: 'delete',
        position: pos,
        length: diffLen,
      };
    } else if (newText !== prevText) {
      // Replace
      let pos = 0;
      while (pos < newText.length && prevText[pos] === newText[pos]) pos++;
      let endOld = prevText.length - 1;
      let endNew = newText.length - 1;
      while (endOld > pos && endNew > pos && prevText[endOld] === newText[endNew]) {
        endOld--;
        endNew--;
      }
      delta = {
        type: 'replace',
        position: pos,
        length: endOld - pos + 1,
        text: newText.substring(pos, endNew + 1),
      };
    }

    emitContentChange(delta);
    updateActiveStyles();
  }, [emitContentChange]);

  // ===== Active styles =====
  const updateActiveStyles = useCallback(() => {
    if (!editorRef.current) return;
    const styles = detectActiveStyles(editorRef.current);
    setActiveStyles(styles);
    onActiveStylesChange?.(styles);
  }, [onActiveStylesChange]);

  // ===== Selection change handler =====
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    // Emit selection change
    if (onSelectionChange) {
      const start = getTextOffset(editorRef.current, range.startContainer, range.startOffset);
      const end = getTextOffset(editorRef.current, range.endContainer, range.endOffset);
      onSelectionChange({ start, end });
    }

    // Update active styles
    updateActiveStyles();

    // Show/hide toolbar
    if (showToolbar && !readOnly && !range.collapsed) {
      // Clear any pending hide
      if (hideToolbarTimerRef.current) {
        clearTimeout(hideToolbarTimerRef.current);
        hideToolbarTimerRef.current = null;
      }
      // Position toolbar
      setTimeout(() => positionToolbar(), 50);
    } else {
      // Delay hiding to prevent flicker
      hideToolbarTimerRef.current = setTimeout(() => {
        setToolbarVisible(false);
      }, 200);
    }
  }, [showToolbar, readOnly, onSelectionChange, updateActiveStyles]);

  // Listen for selectionchange
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // ===== Toolbar positioning =====
  const positionToolbar = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setToolbarVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      setToolbarVisible(false);
      return;
    }

    const toolbarWidth = Math.min(
      (toolbarOptions.length * 36) + ((toolbarOptions.length - 1) * 8) + 48,
      window.innerWidth * 0.9
    );
    const toolbarHeight = 52;

    // Center horizontally relative to viewport
    let x = (window.innerWidth - toolbarWidth) / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - toolbarWidth - 8));

    // Position below selection by default
    let y = rect.bottom + 8;

    // If toolbar would go off screen at bottom, position above
    if (y + toolbarHeight > window.innerHeight - 8) {
      y = rect.top - toolbarHeight - 8;
      if (y < 8) y = 8;
    }

    setToolbarPosition({ x, y });
    setToolbarVisible(true);
  }, [toolbarOptions]);

  // ===== Focus/Blur handlers =====
  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't blur if clicking on toolbar (toolbar uses preventDefault on mouseDown,
    // but check relatedTarget as a safety net)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest('[data-rich-text-toolbar]')) {
      return;
    }
    setTimeout(() => {
      const active = document.activeElement;
      // Check if focus moved to toolbar or is still in editor
      if (active?.closest('[data-rich-text-toolbar]')) return;
      if (editorRef.current?.contains(active)) return;

      isFocusedRef.current = false;
      setIsFocused(false);
      setToolbarVisible(false);
      onBlur?.();
    }, 150);
  }, [onBlur]);

  // ===== Keyboard shortcuts =====
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
      emitContentChange({ type: 'format', position: 0, style: 'bold' });
      updateActiveStyles();
    } else if (mod && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
      emitContentChange({ type: 'format', position: 0, style: 'italic' });
      updateActiveStyles();
    } else if (mod && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
      emitContentChange({ type: 'format', position: 0, style: 'underline' });
      updateActiveStyles();
    } else if (mod && e.shiftKey && e.key === 'x') {
      e.preventDefault();
      document.execCommand('strikethrough');
      emitContentChange({ type: 'format', position: 0, style: 'strikethrough' });
      updateActiveStyles();
    } else if (mod && e.key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        document.execCommand('redo');
        handleInput();
      } else {
        e.preventDefault();
        document.execCommand('undo');
        handleInput();
      }
    } else if (e.key === 'Enter') {
      // Handle list continuation
      handleEnterKey(e);
    }
  }, [emitContentChange, updateActiveStyles, handleInput]);

  const handleEnterKey = useCallback((e: React.KeyboardEvent) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // Find the closest list item
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (tag === 'li') {
          const text = el.textContent || '';
          if (text.trim() === '') {
            // Empty list item: exit list
            e.preventDefault();
            const list = el.parentElement;
            if (list) {
              // Remove the empty li and insert a new paragraph after the list
              el.remove();
              const newDiv = document.createElement('div');
              newDiv.innerHTML = '<br>';
              if (list.nextSibling) {
                list.parentNode?.insertBefore(newDiv, list.nextSibling);
              } else {
                list.parentNode?.appendChild(newDiv);
              }
              // Clean up empty list
              if (list.children.length === 0) {
                list.remove();
              }
              // Move cursor
              const newRange = document.createRange();
              newRange.setStart(newDiv, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              handleInput();
            }
          }
          return;
        }

        // Checklist continuation
        if (el.dataset.type === 'checklist') {
          const text = el.textContent || '';
          // Remove checkbox characters for check
          const cleanText = text.replace(/^[☐☑]\s*/, '').trim();
          if (cleanText === '') {
            // Empty checklist item: exit
            e.preventDefault();
            const newDiv = document.createElement('div');
            newDiv.innerHTML = '<br>';
            if (el.nextSibling) {
              el.parentNode?.insertBefore(newDiv, el.nextSibling);
            } else {
              el.parentNode?.appendChild(newDiv);
            }
            el.remove();
            const newRange = document.createRange();
            newRange.setStart(newDiv, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            handleInput();
          } else {
            // Continue with new checklist item
            e.preventDefault();
            const newItem = document.createElement('div');
            newItem.dataset.type = 'checklist';
            newItem.dataset.checked = 'false';
            newItem.innerHTML = '&#9744; <span data-checklist-text=""><br></span>';
            newItem.style.cssText = el.style.cssText;
            if (el.nextSibling) {
              el.parentNode?.insertBefore(newItem, el.nextSibling);
            } else {
              el.parentNode?.appendChild(newItem);
            }
            const textSpan = newItem.querySelector('[data-checklist-text]');
            if (textSpan) {
              const newRange = document.createRange();
              newRange.setStart(textSpan, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
            handleInput();
          }
          return;
        }
      }
      node = node.parentNode;
    }
  }, [handleInput]);

  // ===== Toolbar action handler =====
  const handleToolbarAction = useCallback((action: ToolbarOption) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Ensure editor is focused
    editor.focus();

    // Restore selection if needed
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    switch (action) {
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'strikethrough':
        document.execCommand('strikethrough');
        break;
      case 'code':
        toggleCode();
        break;
      case 'highlight':
        toggleHighlightAction();
        break;
      case 'heading':
        toggleHeading();
        break;
      case 'bullet':
        document.execCommand('insertUnorderedList');
        break;
      case 'numbered':
        document.execCommand('insertOrderedList');
        break;
      case 'quote':
        toggleQuote();
        break;
      case 'checklist':
        toggleChecklist();
        break;
      case 'link':
        promptInsertLink();
        break;
      case 'undo':
        document.execCommand('undo');
        break;
      case 'redo':
        document.execCommand('redo');
        break;
      case 'clearFormatting':
        document.execCommand('removeFormat');
        break;
      case 'indent':
        document.execCommand('indent');
        break;
      case 'outdent':
        document.execCommand('outdent');
        break;
      case 'alignLeft':
        document.execCommand('justifyLeft');
        break;
      case 'alignCenter':
        document.execCommand('justifyCenter');
        break;
      case 'alignRight':
        document.execCommand('justifyRight');
        break;
    }

    // Emit changes after formatting
    setTimeout(() => {
      emitContentChange({ type: 'format', position: 0, style: action });
      updateActiveStyles();
    }, 0);
  }, [emitContentChange, updateActiveStyles]);

  // ===== Formatting helpers =====

  const toggleCode = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);

    // Check if already in code
    let isCode = false;
    let codeEl: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === 'code') {
          isCode = true;
          codeEl = el;
          break;
        }
      }
      node = node.parentNode;
    }

    if (isCode && codeEl) {
      // Remove code formatting
      const parent = codeEl.parentNode;
      if (parent) {
        while (codeEl.firstChild) {
          parent.insertBefore(codeEl.firstChild, codeEl);
        }
        parent.removeChild(codeEl);
      }
    } else {
      // Apply code formatting
      const fragment = range.extractContents();
      const codeNode = document.createElement('code');
      codeNode.style.fontFamily = 'monospace';
      codeNode.style.backgroundColor = '#F5F5F5';
      codeNode.style.padding = '2px 4px';
      codeNode.style.borderRadius = '3px';
      codeNode.style.fontSize = '0.9em';
      codeNode.appendChild(fragment);
      range.insertNode(codeNode);

      // Restore selection
      const newRange = document.createRange();
      newRange.selectNodeContents(codeNode);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }, []);

  const toggleHighlightAction = useCallback((color?: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);

    // Check if already highlighted
    let isHighlighted = false;
    let markEl: HTMLElement | null = null;
    let node: Node | null = range.startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === 'mark') {
          isHighlighted = true;
          markEl = el;
          break;
        }
      }
      node = node.parentNode;
    }

    if (isHighlighted && markEl) {
      // Remove highlight
      const parent = markEl.parentNode;
      if (parent) {
        while (markEl.firstChild) {
          parent.insertBefore(markEl.firstChild, markEl);
        }
        parent.removeChild(markEl);
      }
    } else {
      // Apply highlight
      const fragment = range.extractContents();
      const markNode = document.createElement('mark');
      markNode.style.backgroundColor = color || 'rgba(255, 255, 0, 0.5)';
      markNode.appendChild(fragment);
      range.insertNode(markNode);

      const newRange = document.createRange();
      newRange.selectNodeContents(markNode);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }, []);

  const toggleHeading = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Check if already in heading
    let node: Node | null = sel.getRangeAt(0).startContainer;
    let inHeading = false;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) {
          inHeading = true;
          break;
        }
      }
      node = node.parentNode;
    }

    if (inHeading) {
      document.execCommand('formatBlock', false, 'div');
    } else {
      document.execCommand('formatBlock', false, 'h2');
    }
  }, []);

  const toggleQuote = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node: Node | null = sel.getRangeAt(0).startContainer;
    let inQuote = false;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if ((node as HTMLElement).tagName.toLowerCase() === 'blockquote') {
          inQuote = true;
          break;
        }
      }
      node = node.parentNode;
    }

    if (inQuote) {
      document.execCommand('formatBlock', false, 'div');
    } else {
      document.execCommand('formatBlock', false, 'blockquote');
    }
  }, []);

  const toggleChecklist = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

    const range = sel.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // Check if already in checklist
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.dataset.type === 'checklist') {
          // Remove checklist: convert to plain div
          const textSpan = el.querySelector('[data-checklist-text]');
          const content = textSpan ? textSpan.innerHTML : el.innerHTML.replace(/^[☐☑]\s*/, '');
          const newDiv = document.createElement('div');
          newDiv.innerHTML = content || '<br>';
          el.replaceWith(newDiv);

          const newRange = document.createRange();
          newRange.selectNodeContents(newDiv);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
          handleInput();
          return;
        }
      }
      node = node.parentNode;
    }

    // Find the current block element
    node = range.startContainer;
    let blockEl: HTMLElement | null = null;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'div' || tag === 'p' || /^h[1-6]$/.test(tag)) {
          blockEl = el;
          break;
        }
      }
      node = node.parentNode;
    }

    if (blockEl) {
      const content = blockEl.innerHTML;
      const checklistDiv = document.createElement('div');
      checklistDiv.dataset.type = 'checklist';
      checklistDiv.dataset.checked = 'false';
      checklistDiv.innerHTML = `&#9744; <span data-checklist-text="">${content}</span>`;
      blockEl.replaceWith(checklistDiv);

      const textSpan = checklistDiv.querySelector('[data-checklist-text]');
      if (textSpan) {
        const newRange = document.createRange();
        newRange.selectNodeContents(textSpan);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      handleInput();
    }
  }, [handleInput]);

  const promptInsertLink = useCallback(() => {
    const sel = window.getSelection();
    const selectedText = sel?.toString() || '';

    const text = prompt('Link text:', selectedText);
    if (!text) return;
    const url = prompt('URL:');
    if (!url) return;

    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      // Replace selection with link
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const link = document.createElement('a');
      link.href = url;
      link.textContent = text;
      link.style.color = '#2196F3';
      link.style.textDecoration = 'underline';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      range.insertNode(link);
    } else {
      // Insert link at cursor
      const link = document.createElement('a');
      link.href = url;
      link.textContent = text;
      link.style.color = '#2196F3';
      link.style.textDecoration = 'underline';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.insertNode(link);
      }
    }

    handleInput();
  }, [handleInput]);

  // ===== Click handler for checklists =====
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Check if clicking on a checkbox character in checklist
    const checklistItem = target.closest('[data-type="checklist"]') as HTMLElement;
    if (checklistItem) {
      // Check if click is on the checkbox area (first 20px)
      const rect = checklistItem.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < 25) {
        const isChecked = checklistItem.dataset.checked === 'true';
        checklistItem.dataset.checked = isChecked ? 'false' : 'true';
        // Update checkbox visual
        const textContent = checklistItem.innerHTML;
        if (isChecked) {
          checklistItem.innerHTML = textContent.replace('☑', '☐').replace('&#9745;', '&#9744;');
        } else {
          checklistItem.innerHTML = textContent.replace('☐', '☑').replace('&#9744;', '&#9745;');
        }
        handleInput();
        e.preventDefault();
      }
    }
  }, [handleInput]);

  // ===== Imperative API =====
  useImperativeHandle(ref, () => ({
    setContent: (blocks: Block[]) => {
      if (!editorRef.current) return;
      isInternalChangeRef.current = true;
      editorRef.current.innerHTML = blocksToHTML(blocks);
      setIsEmpty(blocks.length === 0 || (blocks.length === 1 && !blocks[0].text));
      isInternalChangeRef.current = false;
      previousTextRef.current = editorRef.current.innerText;
      emitContentChange();
    },

    getText: async () => {
      return editorRef.current?.innerText || '';
    },

    getBlocks: async () => {
      if (!editorRef.current) return [];
      return parseBlocksFromDOM(editorRef.current);
    },

    clear: () => {
      if (!editorRef.current) return;
      isInternalChangeRef.current = true;
      editorRef.current.innerHTML = '';
      setIsEmpty(true);
      isInternalChangeRef.current = false;
      previousTextRef.current = '';
      emitContentChange();
    },

    focus: () => {
      editorRef.current?.focus();
    },

    blur: () => {
      editorRef.current?.blur();
    },

    toggleBold: () => {
      editorRef.current?.focus();
      document.execCommand('bold');
      emitContentChange({ type: 'format', position: 0, style: 'bold' });
      updateActiveStyles();
    },

    toggleItalic: () => {
      editorRef.current?.focus();
      document.execCommand('italic');
      emitContentChange({ type: 'format', position: 0, style: 'italic' });
      updateActiveStyles();
    },

    toggleUnderline: () => {
      editorRef.current?.focus();
      document.execCommand('underline');
      emitContentChange({ type: 'format', position: 0, style: 'underline' });
      updateActiveStyles();
    },

    toggleStrikethrough: () => {
      editorRef.current?.focus();
      document.execCommand('strikethrough');
      emitContentChange({ type: 'format', position: 0, style: 'strikethrough' });
      updateActiveStyles();
    },

    toggleCode: () => {
      editorRef.current?.focus();
      toggleCode();
      emitContentChange({ type: 'format', position: 0, style: 'code' });
      updateActiveStyles();
    },

    toggleHighlight: (color?: string) => {
      editorRef.current?.focus();
      toggleHighlightAction(color);
      emitContentChange({ type: 'format', position: 0, style: 'highlight' });
      updateActiveStyles();
    },

    setHeading: () => {
      editorRef.current?.focus();
      toggleHeading();
      handleInput();
      updateActiveStyles();
    },

    setBulletList: () => {
      editorRef.current?.focus();
      document.execCommand('insertUnorderedList');
      handleInput();
      updateActiveStyles();
    },

    setNumberedList: () => {
      editorRef.current?.focus();
      document.execCommand('insertOrderedList');
      handleInput();
      updateActiveStyles();
    },

    setQuote: () => {
      editorRef.current?.focus();
      toggleQuote();
      handleInput();
      updateActiveStyles();
    },

    setChecklist: () => {
      editorRef.current?.focus();
      toggleChecklist();
      updateActiveStyles();
    },

    setParagraph: () => {
      editorRef.current?.focus();
      document.execCommand('formatBlock', false, 'div');
      handleInput();
      updateActiveStyles();
    },

    insertLink: (url: string, text: string) => {
      editorRef.current?.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (!range.collapsed) {
          range.deleteContents();
        }
        const link = document.createElement('a');
        link.href = url;
        link.textContent = text;
        link.style.color = '#2196F3';
        link.style.textDecoration = 'underline';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        range.insertNode(link);
        range.setStartAfter(link);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      handleInput();
    },

    undo: () => {
      editorRef.current?.focus();
      document.execCommand('undo');
      handleInput();
    },

    redo: () => {
      editorRef.current?.focus();
      document.execCommand('redo');
      handleInput();
    },

    clearFormatting: () => {
      editorRef.current?.focus();
      document.execCommand('removeFormat');
      emitContentChange({ type: 'format', position: 0, style: 'clearFormatting' });
      updateActiveStyles();
    },

    indent: () => {
      editorRef.current?.focus();
      document.execCommand('indent');
      handleInput();
    },

    outdent: () => {
      editorRef.current?.focus();
      document.execCommand('outdent');
      handleInput();
    },

    setAlignment: (alignment: TextAlignment) => {
      editorRef.current?.focus();
      switch (alignment) {
        case 'left': document.execCommand('justifyLeft'); break;
        case 'center': document.execCommand('justifyCenter'); break;
        case 'right': document.execCommand('justifyRight'); break;
      }
      handleInput();
      updateActiveStyles();
    },

    toggleChecklistItem: () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

      let node: Node | null = sel.getRangeAt(0).startContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.dataset.type === 'checklist') {
            const isChecked = el.dataset.checked === 'true';
            el.dataset.checked = isChecked ? 'false' : 'true';
            const content = el.innerHTML;
            if (isChecked) {
              el.innerHTML = content.replace('☑', '☐').replace('&#9745;', '&#9744;');
            } else {
              el.innerHTML = content.replace('☐', '☑').replace('&#9744;', '&#9745;');
            }
            handleInput();
            return;
          }
        }
        node = node.parentNode;
      }
    },
  }), [
    emitContentChange, handleInput, updateActiveStyles,
    toggleCode, toggleHighlightAction, toggleHeading, toggleQuote, toggleChecklist,
  ]);

  // ===== Paste handler =====
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // ===== Styles =====
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    ...(variant === 'outlined'
      ? {
          border: '1px solid #E0E0E0',
          borderRadius: 8,
        }
      : {
          border: 'none',
          borderBottom: '1px solid #E0E0E0',
          borderRadius: 0,
        }),
    ...style,
  };

  const editorStyle: React.CSSProperties = {
    outline: 'none',
    padding: '12px',
    fontSize: 16,
    lineHeight: 1.3,
    color: '#000000',
    minHeight: 44,
    maxHeight: maxHeight || undefined,
    overflowY: maxHeight ? 'auto' : undefined,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  };

  const placeholderStyle: React.CSSProperties = {
    position: 'absolute',
    top: 12,
    left: 13,
    color: '#9E9E9E',
    fontSize: 16,
    pointerEvents: 'none',
    userSelect: 'none',
    lineHeight: 1.3,
  };

  return (
    <>
      <div ref={containerRef} style={containerStyle} className={className}>
        {isEmpty && placeholder && (
          <div style={placeholderStyle}>{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onPaste={handlePaste}
          style={editorStyle}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
          data-placeholder={placeholder}
          spellCheck
        />
      </div>

      {/* Floating toolbar rendered via portal-like fixed positioning */}
      {showToolbar && !readOnly && (
        <FloatingToolbar
          position={toolbarPosition}
          activeStyles={activeStyles}
          options={toolbarOptions}
          onAction={handleToolbarAction}
          visible={toolbarVisible}
        />
      )}

      {/* Editor-specific styles */}
      <style>{`
        [contenteditable] blockquote {
          border-left: 4px solid #E0E0E0;
          margin: 4px 0;
          padding: 4px 12px;
          color: #666;
          font-style: italic;
        }
        [contenteditable] h1, [contenteditable] h2, [contenteditable] h3 {
          margin: 4px 0;
          line-height: 1.3;
        }
        [contenteditable] h2 {
          font-size: 1.5em;
        }
        [contenteditable] ul, [contenteditable] ol {
          margin: 4px 0;
          padding-left: 24px;
        }
        [contenteditable] li {
          margin: 2px 0;
        }
        [contenteditable] code {
          font-family: monospace;
          background-color: #F5F5F5;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        [contenteditable] mark {
          background-color: rgba(255, 255, 0, 0.5);
          padding: 0 2px;
        }
        [contenteditable] a {
          color: #2196F3;
          text-decoration: underline;
        }
        [contenteditable] [data-type="checklist"] {
          cursor: default;
          padding: 2px 0;
          line-height: 1.5;
        }
        [contenteditable] [data-type="checklist"][data-checked="true"] [data-checklist-text] {
          text-decoration: line-through;
          color: #999;
        }
      `}</style>
    </>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

// ===== Helper: get text offset =====
function getTextOffset(root: HTMLElement, targetNode: Node, targetOffset: number): number {
  let offset = 0;

  function walk(node: Node): boolean {
    if (node === targetNode) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        for (let i = 0; i < targetOffset && i < node.childNodes.length; i++) {
          walkAll(node.childNodes[i]);
        }
      }
      return true;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent || '').length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
    }
    return false;
  }

  function walkAll(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += (node.textContent || '').length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        walkAll(node.childNodes[i]);
      }
    }
  }

  walk(root);
  return offset;
}

export default RichTextEditor;

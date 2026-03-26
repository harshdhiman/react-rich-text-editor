import React, { useRef, useCallback, useEffect, useState } from "react";
import { ActiveStylesState, ToolbarOption } from "./types";
import { getIcon } from "./ToolbarIcons";

interface FloatingToolbarProps {
  position: { x: number; y: number };
  activeStyles: ActiveStylesState;
  options: ToolbarOption[];
  onAction: (action: ToolbarOption) => void;
  visible: boolean;
  maxWidth?: number;
}

const TOOLBAR_BG = "#2D2D2D";
const ACTIVE_COLOR = "#5082C8";
const INACTIVE_COLOR = "#FFFFFF";
const ACTIVE_BG = "rgba(255, 255, 255, 0.15)";
const BUTTON_SIZE = 36;
const BUTTON_SPACING = 8;
const TOOLBAR_HEIGHT = 52;
const ICON_SIZE = 20;
const ARROW_WIDTH = 16;

const isOptionActive = (
  option: ToolbarOption,
  styles: ActiveStylesState,
): boolean => {
  switch (option) {
    case "bold":
      return styles.bold;
    case "italic":
      return styles.italic;
    case "underline":
      return styles.underline;
    case "strikethrough":
      return styles.strikethrough;
    case "code":
      return styles.code;
    case "highlight":
      return styles.highlight;
    case "heading":
      return styles.blockType === "heading";
    case "bullet":
      return styles.blockType === "bullet";
    case "numbered":
      return styles.blockType === "numbered";
    case "quote":
      return styles.blockType === "quote";
    case "checklist":
      return styles.blockType === "checklist";
    case "alignLeft":
      return styles.alignment === "left";
    case "alignCenter":
      return styles.alignment === "center";
    case "alignRight":
      return styles.alignment === "right";
    default:
      return false;
  }
};

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position,
  activeStyles,
  options,
  onAction,
  visible,
  maxWidth = 400,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 5);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
  }, [visible, options, updateScrollIndicators]);

  const handleScroll = useCallback(() => {
    updateScrollIndicators();
  }, [updateScrollIndicators]);

  const scrollLeft = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -150, behavior: "smooth" });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 150, behavior: "smooth" });
    }
  }, []);

  const handleButtonMouseDown = useCallback(
    (e: React.MouseEvent, action: ToolbarOption) => {
      e.preventDefault();
      e.stopPropagation();
      onAction(action);
    },
    [onAction],
  );

  if (!visible) return null;

  const toolbarWidth = Math.min(
    options.length * BUTTON_SIZE + (options.length - 1) * BUTTON_SPACING + 48,
    maxWidth,
    window.innerWidth * 0.9,
  );

  return (
    <div
      data-rich-text-toolbar=""
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        backgroundColor: TOOLBAR_BG,
        borderRadius: 10,
        padding: "8px",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.3)",
        width: toolbarWidth,
        height: TOOLBAR_HEIGHT,
        boxSizing: "border-box",
        userSelect: "none",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        onClick={scrollLeft}
        style={{
          width: ARROW_WIDTH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.7)",
          fontSize: 20,
          fontWeight: "bold",
          flexShrink: 0,
          visibility: showLeftArrow ? "visible" : "hidden",
        }}
      >
        &#x2039;
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          display: "flex",
          alignItems: "center",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: BUTTON_SPACING }}
        >
          {options.map((option) => {
            const IconComponent = getIcon(option);
            if (!IconComponent) return null;

            const active = isOptionActive(option, activeStyles);
            const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;

            return (
              <button
                key={option}
                onMouseDown={(e) => handleButtonMouseDown(e, option)}
                title={option}
                style={{
                  width: BUTTON_SIZE,
                  height: BUTTON_SIZE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? ACTIVE_BG : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                  outline: "none",
                  transition: "background-color 0.15s",
                }}
              >
                <IconComponent color={color} size={ICON_SIZE} />
              </button>
            );
          })}
        </div>
      </div>

      <div
        onClick={scrollRight}
        style={{
          width: ARROW_WIDTH,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.7)",
          fontSize: 20,
          fontWeight: "bold",
          flexShrink: 0,
          visibility: showRightArrow ? "visible" : "hidden",
        }}
      >
        &#x203A;
      </div>

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTab } from "../../contexts/TabContext";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./TabBar.css";

const TabBar = () => {
  const {
    tabs,
    activeTab,
    switchTab,
    closeTab,
    closeTabsToRight,
    closeTabsToLeft,
    closeOtherTabs,
  } = useTab();
  const tabsContainerRef = useRef(null);
  const contextMenuRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, tabId }

  const checkScrollButtons = () => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  const handleTabClick = (tabId) => {
    if (contextMenu) return;
    switchTab(tabId);
  };

  const handleTabClose = (e, tabId) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleKeyDown = (e, tabId) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      switchTab(tabId);
    }
  };

  const handleContextMenu = (e, tabId) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Close context menu on any outside click or scroll.
  // Use a ref to detect clicks inside the menu (capture-phase fires before click).
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target))
        return;
      closeContextMenu();
    };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("scroll", handler, true);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("scroll", handler, true);
    };
  }, [contextMenu, closeContextMenu]);

  useEffect(() => {
    checkScrollButtons();
    const handleResize = () => checkScrollButtons();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [tabs]);

  useEffect(() => {
    if (activeTab && tabsContainerRef.current) {
      const activeTabElement = tabsContainerRef.current.querySelector(
        `[data-tab-id="${activeTab}"]`,
      );
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab]);

  if (tabs.length === 0) return null;

  const ctxTab = contextMenu
    ? tabs.find((t) => t.id === contextMenu.tabId)
    : null;
  const ctxIndex = ctxTab ? tabs.indexOf(ctxTab) : -1;
  const hasClosableRight = ctxTab
    ? tabs.slice(ctxIndex + 1).some((t) => t.closable)
    : false;
  const hasClosableLeft = ctxTab
    ? tabs.slice(0, ctxIndex).some((t) => t.closable)
    : false;
  const hasClosableOther = ctxTab
    ? tabs.some((t) => t.closable && t.id !== contextMenu?.tabId)
    : false;

  return (
    <>
      <div className="tab-bar">
        {showLeftScroll && (
          <button
            className="tab-scroll-button tab-scroll-left"
            onClick={scrollLeft}
            aria-label="Scroll tabs left"
          >
            <FiChevronLeft />
          </button>
        )}

        <div
          className="tab-container"
          ref={tabsContainerRef}
          onScroll={checkScrollButtons}
        >
          <div className="tab-list">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                className={`tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => handleTabClick(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                tabIndex={0}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                <span className="tab-title" title={tab.title}>
                  {tab.title}
                </span>
                {tab.closable && (
                  <button
                    className="tab-close-button"
                    onClick={(e) => handleTabClose(e, tab.id)}
                    aria-label={`Close ${tab.title} tab`}
                    tabIndex={-1}
                  >
                    <FiX />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {showRightScroll && (
          <button
            className="tab-scroll-button tab-scroll-right"
            onClick={scrollRight}
            aria-label="Scroll tabs right"
          >
            <FiChevronRight />
          </button>
        )}
      </div>

      {contextMenu && ctxTab && (
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {ctxTab.closable && (
            <button
              className="tab-ctx-item"
              onClick={() => {
                closeTab(contextMenu.tabId);
                closeContextMenu();
              }}
            >
              Close tab
            </button>
          )}
          {hasClosableOther && (
            <button
              className="tab-ctx-item"
              onClick={() => {
                closeOtherTabs(contextMenu.tabId);
                closeContextMenu();
              }}
            >
              Close other tabs
            </button>
          )}
          {hasClosableRight && (
            <button
              className="tab-ctx-item"
              onClick={() => {
                closeTabsToRight(contextMenu.tabId);
                closeContextMenu();
              }}
            >
              Close tabs to the right
            </button>
          )}
          {hasClosableLeft && (
            <button
              className="tab-ctx-item"
              onClick={() => {
                closeTabsToLeft(contextMenu.tabId);
                closeContextMenu();
              }}
            >
              Close tabs to the left
            </button>
          )}
          {!ctxTab.closable &&
            !hasClosableOther &&
            !hasClosableRight &&
            !hasClosableLeft && (
              <span className="tab-ctx-item tab-ctx-disabled">
                No actions available
              </span>
            )}
        </div>
      )}
    </>
  );
};

export default TabBar;

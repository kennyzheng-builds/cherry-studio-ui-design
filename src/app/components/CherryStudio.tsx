import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './layout/Sidebar';
import { TabBar } from './layout/TabBar';
import { TabContextMenu } from './ui/TabContextMenu';
import { SearchDialog } from './ui/SearchDialog';
import { NewTabDialog } from './ui/NewTabDialog';
import { DragGhost } from './ui/DragGhost';
import { MainContent } from './MainContent';
import {
  menuItems, SIDEBAR_MENU_IDS, getLayout, BP_ICON, BP_VERTICAL_CARD,
  dialogAppIcons, MOCK_RESOURCES,
} from '@/app/config/constants';
import type { Tab, MenuItem, ContextMenuState, DetachedWindow } from '@/app/types';
import { SettingsPage } from './settings/SettingsPage';
import { SettingsProvider } from '@/app/context/SettingsContext';
import { GlobalActionProvider } from '@/app/context/GlobalActionContext';
import type { GlobalActions } from '@/app/context/GlobalActionContext';
import { Toaster } from 'sonner';
import { initGlobalErrorHandler } from '@/app/services/errorHandler';
import { useTabs } from '@/app/hooks/useTabs';
import { useFloatingWindows } from '@/app/hooks/useFloatingWindows';
import { useTabDrag } from '@/app/hooks/useTabDrag';

// ===========================
// Main UI
// ===========================
function CherryStudioInner() {
  const [sidebarWidth, setSidebarWidth] = useState(170);
  const [activeItem, setActiveItem] = useState('chat');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, tabId: '' });
  const [hoverVisible, setHoverVisible] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [newTabDialogOpen, setNewTabDialogOpen] = useState(false);
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [appOrder, setAppOrder] = useState<string[]>(() => dialogAppIcons.map(a => a.id));

  const [libraryEditResourceId, setLibraryEditResourceId] = useState<string | null>(null);
  const [libraryCreateType, setLibraryCreateType] = useState<'agent' | 'assistant' | null>(null);
  const [libraryReturnTo, setLibraryReturnTo] = useState<string | null>(null);

  // --- Extracted hooks ---
  const {
    tabs, setTabs, activeTabId, setActiveTabId,
    handleCloseTab, createTabForMenuItem,
    replaceTabWithMenuItem,
    handleDialogCreateTab,
    handleSidebarItemClick: sidebarClickFromHook,
    handleOpenMiniApp, handlePinTab, handleTabTitleChange,
    handleDockToSidebar, handleUndockFromSidebar, dockedTabs,
  } = useTabs();

  // New tab = open dialog (floating), pick → create the actual tab.
  // No placeholder "newtab" tab is created anymore.
  const openNewTabDialog = useCallback(() => setNewTabDialogOpen(true), []);

  // Batch close helpers for tab context menu.
  // Protected tabs (home / miniapp / pinned / non-closeable) are preserved.
  const isClosableSibling = useCallback((t: Tab, keepId: string) => {
    return t.id !== keepId && t.closeable && !t.pinned && t.id !== 'home' && !t.miniAppId;
  }, []);

  const handleCloseOtherTabs = useCallback((keepTabId: string) => {
    setTabs(prev => {
      const next = prev.filter(t => !isClosableSibling(t, keepTabId));
      if (!next.find(t => t.id === activeTabId)) setActiveTabId(keepTabId);
      return next;
    });
  }, [activeTabId, isClosableSibling, setTabs, setActiveTabId]);

  const handleCloseTabsToRight = useCallback((anchorTabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === anchorTabId);
      if (idx === -1) return prev;
      const next = prev.filter((t, i) => i <= idx || !isClosableSibling(t, anchorTabId));
      if (!next.find(t => t.id === activeTabId)) setActiveTabId(anchorTabId);
      return next;
    });
  }, [activeTabId, isClosableSibling, setTabs, setActiveTabId]);

  const {
    detachedWindows, addWindow, removeWindow, updateWindow,
  } = useFloatingWindows();

  // ===========================
  // Detach / reattach orchestration
  // ===========================
  // Tabs are *not* removed from the tabs array on detach — they're only marked
  // `detached: true`. MainContent swaps styling from inline pane to floating
  // window while keeping the React tree stable, so component state (chat
  // messages, inputs, scroll) survives the transition.
  const handleDetachTab = useCallback((tabId: string, x: number, y: number) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab || !tab.closeable) return prev;
      addWindow(tab, x, y);
      return prev.map(t => t.id === tabId ? { ...t, detached: true } : t);
    });
    // If we just detached the active tab, switch focus to another visible tab
    setActiveTabId(curr => {
      if (curr !== tabId) return curr;
      const others = tabs.filter(t => t.id !== tabId && !t.detached);
      const closeable = others.filter(t => t.closeable);
      if (closeable.length > 0) return closeable[closeable.length - 1].id;
      if (others.length > 0) return others[0].id;
      return curr;
    });
  }, [tabs, addWindow]);

  const handleReattachWindow = useCallback((win: DetachedWindow) => {
    removeWindow(win.id);
    setTabs(prev => prev.map(t => t.id === win.tabId ? { ...t, detached: false } : t));
    setActiveTabId(win.tabId);
  }, [removeWindow]);

  const handleCloseFloatingWindow = useCallback((win: DetachedWindow) => {
    removeWindow(win.id);
    // Closing the window closes the underlying tab too (browser behaviour)
    setTabs(prev => prev.filter(t => t.id !== win.tabId));
    setActiveTabId(curr => {
      if (curr !== win.tabId) return curr;
      const remaining = tabs.filter(t => t.id !== win.tabId && !t.detached);
      const closeable = remaining.filter(t => t.closeable);
      if (closeable.length > 0) return closeable[closeable.length - 1].id;
      if (remaining.length > 0) return remaining[0].id;
      return curr;
    });
  }, [removeWindow, tabs]);

  const {
    dragGhost, sidebarContainerRef, startTabDrag, startSidebarDrag,
  } = useTabDrag();

  // ===========================
  // Sync sidebar highlight with active tab
  // ===========================
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.menuItemId) {
      setActiveItem(tab.menuItemId);
    }
  }, [activeTabId, tabs]);

  // ===========================
  // Library navigation
  // ===========================
  const handleEditAssistantInLibrary = useCallback((assistantName: string) => {
    const resource = MOCK_RESOURCES.find(r => r.name === assistantName && (r.type === 'assistant' || r.type === 'agent'));
    setLibraryEditResourceId(resource?.id || null);
    navigateToMenuTab('library');
  }, [tabs]);

  const handleNavigateToLibrary = useCallback((createType?: 'agent' | 'assistant') => {
    if (createType) {
      setLibraryCreateType(createType);
      setLibraryReturnTo(createType === 'assistant' ? 'chat' : 'agent');
    }
    navigateToMenuTab('library');
  }, [tabs]);

  const handleLibraryReturn = useCallback(() => {
    const returnTo = libraryReturnTo;
    setLibraryCreateType(null);
    setLibraryReturnTo(null);
    if (returnTo) {
      setActiveItem(returnTo);
      const existing = tabs.find(t => t.menuItemId === returnTo);
      if (existing) setActiveTabId(existing.id);
    }
  }, [libraryReturnTo, tabs]);

  const handleNavigateToKnowledge = useCallback((kbName: string) => {
    navigateToMenuTab('knowledge');
  }, [tabs]);

  // Helper: navigate to a single-instance menu tab
  const navigateToMenuTab = useCallback((menuItemId: string) => {
    setActiveItem(menuItemId);
    const existing = tabs.find(t => t.menuItemId === menuItemId);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      createTabForMenuItem(menuItemId);
    }
  }, [tabs, createTabForMenuItem]);

  // Clear library state when navigating away
  useEffect(() => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab?.menuItemId !== 'library') {
      if (libraryEditResourceId) setLibraryEditResourceId(null);
      if (libraryCreateType) setLibraryCreateType(null);
      if (libraryReturnTo) setLibraryReturnTo(null);
    }
  }, [activeTabId, tabs, libraryEditResourceId, libraryCreateType, libraryReturnTo]);

  // ===========================
  // Sidebar item filtering
  // ===========================
  // The sidebar shows a slim curated list (SIDEBAR_MENU_IDS) so it stays
  // minimalist — everything else is reachable from the "+" new-tab dialog.
  const visibleMenuItems = useMemo(
    () => SIDEBAR_MENU_IDS
      .map(id => menuItems.find(m => m.id === id))
      .filter((m): m is MenuItem => !!m)
      .filter(m => !hiddenApps.has(m.id)),
    [hiddenApps],
  );

  // ===========================
  // Sidebar handler
  // ===========================
  // Tab management itself lives in useTabs (Model A: "navigate to module").
  // This wrapper only adds CherryStudio-level UI side-effects (sidebar
  // highlight + dismissing the floating sidebar overlay).
  const handleSidebarItemClick = useCallback((menuItemId: string) => {
    sidebarClickFromHook(menuItemId, () => {
      setActiveItem(menuItemId);
      setHoverVisible(false);
    });
  }, [sidebarClickFromHook]);

  // Cmd/Ctrl+T: open the new-tab dialog (floating)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        openNewTabDialog();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openNewTabDialog]);

  // ===========================
  // Drag callbacks (bridge hooks)
  // ===========================
  const onStartTabDrag = useCallback((e: React.MouseEvent, tabId: string) => {
    startTabDrag(e, tabId, {
      onDockToSidebar: handleDockToSidebar,
      onDetachTab: (tid, x, y) => handleDetachTab(tid, x, y),
    });
  }, [startTabDrag, handleDockToSidebar, handleDetachTab]);

  const onStartSidebarDrag = useCallback((e: React.MouseEvent, tabId: string) => {
    startSidebarDrag(e, tabId, { onUndockFromSidebar: handleUndockFromSidebar });
  }, [startSidebarDrag, handleUndockFromSidebar]);

  // Pin no longer protects against session/topic switches. A tab is a
  // persistent container for its module — switching the topic/session inside
  // it is just internal state mutation, not a new-tab event. We keep the
  // boolean return for API compatibility with consuming pages: returning
  // false means "you handle it (in-place)".
  const requestOpenTopic = useCallback((_topicId: string, _title?: string) => false, []);
  const requestOpenSession = useCallback((_sessionId: string, _title?: string) => false, []);

  // ===========================
  // GlobalActionContext value
  // ===========================
  const globalActions = useMemo<GlobalActions>(() => ({
    openMiniApp: handleOpenMiniApp,
    pinTab: handlePinTab,
    editAssistantInLibrary: handleEditAssistantInLibrary,
    navigateToKnowledge: handleNavigateToKnowledge,
    navigateToLibrary: handleNavigateToLibrary,
    libraryReturn: handleLibraryReturn,
    changeTabTitle: handleTabTitleChange,
    openSettings: () => setSettingsOpen(true),
    replaceTabWithMenuItem,
    requestOpenTopic,
    requestOpenSession,
    setHiddenApps,
    setAppOrder,
    libraryEditResourceId,
    libraryCreateType,
    hiddenApps,
    appOrder,
  }), [
    handleOpenMiniApp, handlePinTab, handleEditAssistantInLibrary,
    handleNavigateToKnowledge, handleNavigateToLibrary, handleLibraryReturn,
    handleTabTitleChange, libraryEditResourceId, libraryCreateType,
    replaceTabWithMenuItem, requestOpenTopic, requestOpenSession,
    hiddenApps, appOrder,
  ]);

  // ===========================
  // Render
  // ===========================
  return (
    <GlobalActionProvider value={globalActions}>
      <div className="flex items-center justify-center h-screen w-full bg-neutral-200 dark:bg-neutral-900 p-6">
        <div id="cherry-app-root" className="flex flex-row w-full h-full max-w-[1200px] max-h-[800px] bg-sidebar text-foreground rounded-2xl border border-border overflow-hidden shadow-2xl relative">
          {/* ===== Left column: traffic lights + sidebar =====
              Pin the column width to the sidebar's actual rendered width so
              the traffic-lights row (fixed size) can't push the column wider
              in icon / vertical-card modes. */}
          <div
            ref={sidebarContainerRef}
            className="flex flex-col flex-shrink-0 h-full overflow-hidden"
            style={{
              width: getLayout(sidebarWidth) === 'icon'
                ? BP_ICON
                : getLayout(sidebarWidth) === 'vertical-card'
                  ? BP_VERTICAL_CARD
                  : sidebarWidth,
            }}
          >
            {/* Traffic lights — macOS window chrome, lives on the sidebar side */}
            <div className="h-11 flex items-center gap-[5px] px-3 flex-shrink-0 select-none">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d4a528]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840] border border-[#24a732]" />
            </div>
            <div className="flex-1 min-h-0">
              <Sidebar
                width={sidebarWidth}
                setWidth={setSidebarWidth}
                activeItem={activeItem}
                onItemClick={handleSidebarItemClick}
                onHoverChange={setHoverVisible}
                onSearchClick={() => setSearchDialogOpen(true)}
                onSettingsClick={() => setSettingsOpen(true)}
                items={visibleMenuItems}
                activeMiniAppTabs={tabs.filter(t => t.miniAppId && !t.sidebarDocked)}
                activeTabId={activeTabId}
                onMiniAppTabClick={(tabId) => setActiveTabId(tabId)}
                dockedTabs={dockedTabs}
                onUndockTab={handleUndockFromSidebar}
                onStartSidebarDrag={onStartSidebarDrag}
                onCloseDockedTab={handleCloseTab}
              />
            </div>
          </div>

          {/* ===== Right column: tab bar + content ===== */}
          <div className="flex-1 flex flex-col min-w-0">
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={setActiveTabId}
              onTabClose={handleCloseTab}
              onTabContext={(e, tabId) => {
                e.preventDefault();
                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, tabId });
              }}
              onNewTab={openNewTabDialog}
              startTabDrag={onStartTabDrag}
            />
            <div className={`flex-1 flex flex-col min-h-0 pr-2 pb-2 ${getLayout(sidebarWidth) === 'hidden' ? 'pl-2' : ''}`}>
              <div className="flex-1 bg-background rounded-xl flex flex-col min-h-0 relative">
                <MainContent
                  tabs={tabs}
                  activeTabId={activeTabId}
                  detachedWindows={detachedWindows}
                  onReattachWindow={handleReattachWindow}
                  onCloseFloatingWindow={handleCloseFloatingWindow}
                  onUpdateWindow={updateWindow}
                />
              </div>
            </div>
          </div>

          {dragGhost && (
            <DragGhost
              tabId={dragGhost.tabId}
              x={dragGhost.x}
              y={dragGhost.y}
              overSidebar={dragGhost.overSidebar}
              tabs={tabs}
            />
          )}

          {hoverVisible && getLayout(sidebarWidth) === 'hidden' && (
            <Sidebar
              isFloating
              onDismiss={() => setHoverVisible(false)}
              width={sidebarWidth}
              setWidth={setSidebarWidth}
              activeItem={activeItem}
              onItemClick={handleSidebarItemClick}
              onHoverChange={setHoverVisible}
              onSearchClick={() => setSearchDialogOpen(true)}
              onSettingsClick={() => { setSettingsOpen(true); setHoverVisible(false); }}
              items={visibleMenuItems}
              activeMiniAppTabs={tabs.filter(t => t.miniAppId && !t.sidebarDocked)}
              activeTabId={activeTabId}
              onMiniAppTabClick={(tabId) => setActiveTabId(tabId)}
              dockedTabs={dockedTabs}
              onUndockTab={handleUndockFromSidebar}
              onStartSidebarDrag={onStartSidebarDrag}
              onCloseDockedTab={handleCloseTab}
            />
          )}
        </div>

        <TabContextMenu
          state={contextMenu}
          tab={tabs.find(t => t.id === contextMenu.tabId)}
          tabs={tabs}
          onPin={handlePinTab}
          onClose={handleCloseTab}
          onCloseOthers={handleCloseOtherTabs}
          onCloseRight={handleCloseTabsToRight}
          onDetach={(tabId, x, y) => handleDetachTab(tabId, x, y)}
          onDismiss={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        />

        <SearchDialog
          open={searchDialogOpen}
          onClose={() => setSearchDialogOpen(false)}
        />

        <NewTabDialog
          open={newTabDialogOpen}
          onClose={() => setNewTabDialogOpen(false)}
          onSelect={(id) => { handleDialogCreateTab(id); setNewTabDialogOpen(false); }}
          hiddenApps={hiddenApps}
          appOrder={appOrder}
        />

        <SettingsPage
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </GlobalActionProvider>
  );
}

export function CherryStudio() {
  React.useEffect(() => {
    initGlobalErrorHandler();
  }, []);

  return (
    <SettingsProvider>
      <CherryStudioInner />
      <Toaster position="bottom-right" richColors closeButton />
    </SettingsProvider>
  );
}
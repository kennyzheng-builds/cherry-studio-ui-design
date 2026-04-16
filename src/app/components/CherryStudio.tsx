import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './layout/Sidebar';
import { TabBar } from './layout/TabBar';
import { TabContextMenu } from './ui/TabContextMenu';
import { FloatingWindow } from './ui/FloatingWindow';
import { SearchDialog } from './ui/SearchDialog';
import { DragGhost } from './ui/DragGhost';
import { MainContent } from './MainContent';
import {
  menuItems, getLayout,
  dialogAppIcons, MOCK_RESOURCES, MULTI_INSTANCE_ITEMS,
} from '@/app/config/constants';
import type { Tab, MenuItem, ContextMenuState } from '@/app/types';
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
  const [hiddenApps, setHiddenApps] = useState<Set<string>>(new Set());
  const [appOrder, setAppOrder] = useState<string[]>(() => dialogAppIcons.map(a => a.id));

  const [libraryEditResourceId, setLibraryEditResourceId] = useState<string | null>(null);
  const [libraryCreateType, setLibraryCreateType] = useState<'agent' | 'assistant' | null>(null);
  const [libraryReturnTo, setLibraryReturnTo] = useState<string | null>(null);

  // --- Extracted hooks ---
  const {
    tabs, setTabs, activeTabId, setActiveTabId,
    handleCloseTab, createTabForMenuItem,
    createNewTab, replaceTabWithMenuItem,
    openTopicInNewChatTab, openSessionInNewAgentTab,
    handleOpenMiniApp, handlePinTab, handleTabTitleChange,
    handleDockToSidebar, handleUndockFromSidebar, dockedTabs,
  } = useTabs();

  const {
    detachedWindows, handleDetachTab, handleReattach, handleCloseWindow,
  } = useFloatingWindows();

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
    } else if (tab?.id === 'home') {
      setActiveItem('');
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
  const managedIds = new Set(appOrder);
  const orderedVisible = appOrder
    .filter(id => !hiddenApps.has(id))
    .map(id => menuItems.find(m => m.id === id))
    .filter((m): m is MenuItem => !!m);
  const unmanagedItems = menuItems.filter(m => !managedIds.has(m.id));
  const visibleMenuItems = [...orderedVisible, ...unmanagedItems];

  // ===========================
  // Sidebar & dialog handlers
  // ===========================
  // Pin-protection model:
  // - Active tab pinned/home/miniapp → focus existing single-instance tab, else create new
  // - Active tab unpinned & has menuItemId → replace in-place (kept tab id & position)
  // - Same menuItemId → no-op
  const handleSidebarItemClick = useCallback((menuItemId: string) => {
    setActiveItem(menuItemId);
    setHoverVisible(false);

    const activeTab = tabs.find(t => t.id === activeTabId);

    // Already on this menu item — no-op
    if (activeTab?.menuItemId === menuItemId) return;

    const isReplaceable = !!activeTab
      && !activeTab.pinned
      && activeTab.id !== 'home'
      && !activeTab.miniAppId
      && !!activeTab.menuItemId;

    if (isReplaceable) {
      replaceTabWithMenuItem(activeTab!.id, menuItemId);
      return;
    }

    // Active tab is protected (pinned / home / miniapp) — focus existing or create new
    if (!MULTI_INSTANCE_ITEMS.includes(menuItemId)) {
      const existing = tabs.find(t => t.menuItemId === menuItemId);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
    }
    createTabForMenuItem(menuItemId);
  }, [tabs, activeTabId, createTabForMenuItem, replaceTabWithMenuItem, setActiveTabId]);

  // Cmd/Ctrl+T: open a new tab (browser-like)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        createNewTab();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [createNewTab]);

  // ===========================
  // Drag callbacks (bridge hooks)
  // ===========================
  const onStartTabDrag = useCallback((e: React.MouseEvent, tabId: string) => {
    startTabDrag(e, tabId, {
      onDockToSidebar: handleDockToSidebar,
      onDetachTab: (tid, x, y) => {
        handleDetachTab(tid, x, y, tabs, (remaining) => {
          setTabs(prev => prev.filter(t => t.id !== tid));
          const closeable = remaining.filter(t => t.closeable);
          if (closeable.length > 0) setActiveTabId(closeable[closeable.length - 1].id);
          else if (remaining.length > 0) setActiveTabId(remaining[0].id);
        });
      },
    });
  }, [tabs, startTabDrag, handleDockToSidebar, handleDetachTab]);

  const onStartSidebarDrag = useCallback((e: React.MouseEvent, tabId: string) => {
    startSidebarDrag(e, tabId, { onUndockFromSidebar: handleUndockFromSidebar });
  }, [startSidebarDrag, handleUndockFromSidebar]);

  const onReattach = useCallback((win: typeof detachedWindows[0]) => {
    const newTab = handleReattach(win);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [handleReattach]);

  // Pin-aware topic/session openers — the pages call these first; if we
  // returned true, the page should skip its own in-place switch because we
  // opened a new tab.
  const requestOpenTopic = useCallback((topicId: string, title?: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isProtected = !!activeTab
      && (activeTab.pinned || activeTab.id === 'home' || !!activeTab.miniAppId);
    if (isProtected) {
      openTopicInNewChatTab(topicId, title);
      return true;
    }
    return false;
  }, [tabs, activeTabId, openTopicInNewChatTab]);

  const requestOpenSession = useCallback((sessionId: string, title?: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    const isProtected = !!activeTab
      && (activeTab.pinned || activeTab.id === 'home' || !!activeTab.miniAppId);
    if (isProtected) {
      openSessionInNewAgentTab(sessionId, title);
      return true;
    }
    return false;
  }, [tabs, activeTabId, openSessionInNewAgentTab]);

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
        <div id="cherry-app-root" className="flex flex-col w-full h-full max-w-[1200px] max-h-[800px] bg-sidebar text-foreground rounded-2xl border border-border overflow-hidden shadow-2xl relative">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTabId}
            onTabClose={handleCloseTab}
            onTabContext={(e, tabId) => {
              e.preventDefault();
              setContextMenu({ visible: true, x: e.clientX, y: e.clientY, tabId });
            }}
            onNewTab={createNewTab}
            startTabDrag={onStartTabDrag}
          />

          <div className="flex flex-1 min-h-0">
            <div ref={sidebarContainerRef} className="flex-shrink-0 h-full">
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

            <div className={`flex-1 flex flex-col min-w-0 pr-2 pb-2 ${getLayout(sidebarWidth) === 'hidden' ? 'pl-2' : ''}`}>
              <div className="flex-1 bg-background rounded-xl overflow-hidden flex flex-col min-h-0 relative">
                <MainContent tabs={tabs} activeTabId={activeTabId || 'home'} />
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

          {detachedWindows.map(win => (
            <FloatingWindow
              key={win.id}
              win={win}
              onClose={handleCloseWindow}
              onReattach={onReattach}
            />
          ))}

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
          onPin={handlePinTab}
          onClose={handleCloseTab}
          onDock={(tabId) => {
            const t = tabs.find(tt => tt.id === tabId);
            if (t?.sidebarDocked) handleUndockFromSidebar(tabId);
            else handleDockToSidebar(tabId);
          }}
          onDismiss={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        />

        <SearchDialog
          open={searchDialogOpen}
          onClose={() => setSearchDialogOpen(false)}
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
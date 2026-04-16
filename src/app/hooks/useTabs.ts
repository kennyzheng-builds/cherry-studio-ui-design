import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  MessageCircle, Palette, Languages,
  Home, Puzzle, MousePointerClick, Sparkles,
} from 'lucide-react';
import type { Tab, MenuItem } from '@/app/types';
import { menuItems, MULTI_INSTANCE_ITEMS } from '@/app/config/constants';

export const NEW_TAB_MENU_ID = 'newtab';

// ===========================
// Tab persistence helpers
// ===========================

const STORAGE_KEY_TABS = 'cherry-studio-tabs';
const STORAGE_KEY_ACTIVE = 'cherry-studio-active-tab';

/** Icon field is not serialisable -- strip before saving */
interface SerializableTab extends Omit<Tab, 'icon'> {
  iconKey?: string;
}

/** Map of menuItemId -> icon for icon reconstruction */
const ICON_MAP: Record<string, React.ElementType> = {};
menuItems.forEach(m => { ICON_MAP[m.id] = m.icon; });
ICON_MAP['home'] = Home;
ICON_MAP['miniapp-fallback'] = Puzzle;
ICON_MAP[NEW_TAB_MENU_ID] = Sparkles;

function serializeTabs(tabs: Tab[]): string {
  const serializable: SerializableTab[] = tabs.map(({ icon, ...rest }) => ({
    ...rest,
    iconKey: rest.id === 'home' ? 'home' : rest.menuItemId || (rest.miniAppId ? 'miniapp-fallback' : 'chat'),
  }));
  return JSON.stringify(serializable);
}

function deserializeTabs(json: string): Tab[] | null {
  try {
    const parsed: SerializableTab[] = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map(({ iconKey, ...rest }) => ({
      ...rest,
      icon: ICON_MAP[iconKey || 'chat'] || MessageCircle,
    }));
  } catch {
    return null;
  }
}

const DEFAULT_TABS: Tab[] = [
  { id: 'home', title: '首页', icon: Home, closeable: false },
  { id: 'p1', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat' },
  { id: 'p2', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat' },
  { id: 'p3', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat' },
  { id: 'p4', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat' },
  { id: 't1', title: '聊天话题', icon: MessageCircle, closeable: true, menuItemId: 'chat' },
  { id: 't2', title: '创作', icon: Palette, closeable: true, menuItemId: 'painting' },
  { id: 't3', title: '工作', icon: MousePointerClick, closeable: true, menuItemId: 'agent' },
  { id: 't4', title: '翻译', icon: Languages, closeable: true, menuItemId: 'translate' },
];

function loadTabs(): Tab[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY_TABS);
    if (json) {
      const tabs = deserializeTabs(json);
      if (tabs && tabs.length > 0) return tabs;
    }
  } catch { /* ignore */ }
  return DEFAULT_TABS;
}

function loadActiveTabId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (id) return id;
  } catch { /* ignore */ }
  return 'p1';
}

function saveTabs(tabs: Tab[]) {
  localStorage.setItem(STORAGE_KEY_TABS, serializeTabs(tabs));
}

function saveActiveTabId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE, id);
}

// ===========================
// Hook
// ===========================

export interface UseTabsReturn {
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  handleCloseTab: (id: string) => void;
  createTabForMenuItem: (menuItemId: string) => void;
  createNewTab: () => void;
  replaceTabWithMenuItem: (tabId: string, menuItemId: string) => void;
  openTopicInNewChatTab: (topicId: string, title?: string) => void;
  openSessionInNewAgentTab: (sessionId: string, title?: string) => void;
  handleSidebarItemClick: (menuItemId: string, onAfter?: () => void) => void;
  handleDialogCreateTab: (menuItemId: string, onAfter?: () => void) => void;
  handleOpenMiniApp: (app: { id: string; name: string; color: string; initial: string; url: string; logoUrl?: string }) => void;
  handlePinTab: (tabId: string) => void;
  handleTabTitleChange: (title: string) => void;
  handleDockToSidebar: (tabId: string) => void;
  handleUndockFromSidebar: (tabId: string) => void;
  dockedTabs: Tab[];
}

export function useTabs(): UseTabsReturn {
  const [tabs, setTabs] = useState<Tab[]>(loadTabs);
  const [activeTabId, setActiveTabId] = useState(loadActiveTabId);

  // Persist tabs & activeTabId to localStorage
  useEffect(() => { saveTabs(tabs); }, [tabs]);
  useEffect(() => { saveActiveTabId(activeTabId); }, [activeTabId]);

  const handleCloseTab = useCallback((id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (activeTabId === id && newTabs.length > 0) {
        const closeable = newTabs.filter(t => t.closeable);
        setActiveTabId(closeable.length > 0 ? closeable[closeable.length - 1].id : newTabs[0].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const createTabForMenuItem = useCallback((menuItemId: string) => {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return;
    const newId = `t${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: menuItem.label,
      icon: menuItem.icon,
      closeable: true,
      menuItemId,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  const createNewTab = useCallback(() => {
    const newId = `newtab-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: '新建标签页',
      icon: Sparkles,
      closeable: true,
      menuItemId: NEW_TAB_MENU_ID,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  // Open a specific chat topic in a new (unpinned) chat tab.
  // Used when the active tab is pinned/home/miniapp and the user selects a topic,
  // so the pinned tab isn't replaced.
  const openTopicInNewChatTab = useCallback((topicId: string, title?: string) => {
    const chatMenu = menuItems.find(m => m.id === 'chat');
    const newId = `t${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: title || chatMenu?.label || '聊天',
      icon: chatMenu?.icon || MessageCircle,
      closeable: true,
      menuItemId: 'chat',
      topicId,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  // Open a specific agent session in a new (unpinned) agent tab.
  const openSessionInNewAgentTab = useCallback((sessionId: string, title?: string) => {
    const agentMenu = menuItems.find(m => m.id === 'agent');
    const newId = `t${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: title || agentMenu?.label || '工作',
      icon: agentMenu?.icon || MousePointerClick,
      closeable: true,
      menuItemId: 'agent',
      sessionId,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  // Browser-like: selecting an item from the new-tab page replaces the current tab
  // (instead of stacking another tab on top).
  const replaceTabWithMenuItem = useCallback((tabId: string, menuItemId: string) => {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return;

    // Single-instance menu items: if another tab already owns it, jump there
    // and close the new-tab placeholder.
    if (!MULTI_INSTANCE_ITEMS.includes(menuItemId)) {
      const existing = tabs.find(t => t.menuItemId === menuItemId && t.id !== tabId);
      if (existing) {
        setTabs(prev => prev.filter(t => t.id !== tabId));
        setActiveTabId(existing.id);
        return;
      }
    }

    // Otherwise mutate the current tab in-place (keeps tab position & id)
    setTabs(prev => prev.map(t => t.id === tabId
      ? { ...t, title: menuItem.label, icon: menuItem.icon, menuItemId }
      : t
    ));
    setActiveTabId(tabId);
  }, [tabs]);

  const handleSidebarItemClick = useCallback((menuItemId: string, onAfter?: () => void) => {
    if (MULTI_INSTANCE_ITEMS.includes(menuItemId)) {
      // If current active tab is the same type and still has default title (new/unused), just stay
      const menuItem = menuItems.find(m => m.id === menuItemId);
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.menuItemId === menuItemId && menuItem && activeTab.title === menuItem.label) {
        // Already on a "new" tab of the same type, don't create another
        onAfter?.();
        return;
      }
      // Also check if there's any tab of this type that still has the default title
      const existingNew = tabs.find(t => t.menuItemId === menuItemId && menuItem && t.title === menuItem.label);
      if (existingNew) {
        setActiveTabId(existingNew.id);
        onAfter?.();
        return;
      }
      createTabForMenuItem(menuItemId);
    } else {
      const existing = tabs.find(t => t.menuItemId === menuItemId);
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        createTabForMenuItem(menuItemId);
      }
    }
    onAfter?.();
  }, [tabs, createTabForMenuItem, activeTabId]);

  const handleDialogCreateTab = useCallback((menuItemId: string, onAfter?: () => void) => {
    if (MULTI_INSTANCE_ITEMS.includes(menuItemId)) {
      createTabForMenuItem(menuItemId);
    } else {
      const existing = tabs.find(t => t.menuItemId === menuItemId);
      if (existing) {
        setActiveTabId(existing.id);
      } else {
        createTabForMenuItem(menuItemId);
      }
    }
    onAfter?.();
  }, [tabs, createTabForMenuItem]);

  const handleOpenMiniApp = useCallback((app: { id: string; name: string; color: string; initial: string; url: string; logoUrl?: string }) => {
    const existing = tabs.find(t => t.miniAppId === app.id);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const newId = `miniapp-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: app.name,
      icon: Puzzle,
      closeable: true,
      miniAppId: app.id,
      miniAppColor: app.color,
      miniAppInitial: app.initial,
      miniAppUrl: app.url,
      miniAppLogoUrl: app.logoUrl,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, [tabs]);

  const handlePinTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;
      const tab = prev[idx];
      const updated = { ...tab, pinned: !tab.pinned };
      const rest = prev.filter((_, i) => i !== idx);
      const lastPinned = rest.findLastIndex(t => t.pinned);
      const insertAt = lastPinned + 1;
      return [...rest.slice(0, insertAt), updated, ...rest.slice(insertAt)];
    });
  }, []);

  const handleTabTitleChange = useCallback((title: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, title } : t));
  }, [activeTabId]);

  const handleDockToSidebar = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, sidebarDocked: true, pinned: false } : t));
  }, []);

  const handleUndockFromSidebar = useCallback((tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, sidebarDocked: false } : t));
  }, []);

  const dockedTabs = tabs.filter(t => t.sidebarDocked);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    handleCloseTab,
    createTabForMenuItem,
    createNewTab,
    replaceTabWithMenuItem,
    openTopicInNewChatTab,
    openSessionInNewAgentTab,
    handleSidebarItemClick,
    handleDialogCreateTab,
    handleOpenMiniApp,
    handlePinTab,
    handleTabTitleChange,
    handleDockToSidebar,
    handleUndockFromSidebar,
    dockedTabs,
  };
}
import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import {
  MessageCircle, Palette, Languages,
  Puzzle, MousePointerClick, Sparkles,
} from 'lucide-react';
import type { Tab, MenuItem } from '@/app/types';
import { menuItems } from '@/app/config/constants';

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
ICON_MAP['miniapp-fallback'] = Puzzle;
ICON_MAP[NEW_TAB_MENU_ID] = Sparkles;

function serializeTabs(tabs: Tab[]): string {
  const serializable: SerializableTab[] = tabs.map(({ icon, ...rest }) => ({
    ...rest,
    iconKey: rest.menuItemId || (rest.miniAppId ? 'miniapp-fallback' : 'chat'),
  }));
  return JSON.stringify(serializable);
}

function deserializeTabs(json: string): Tab[] | null {
  try {
    const parsed: SerializableTab[] = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Drop any legacy 'home' tab persisted from earlier versions
    const filtered = parsed.filter(t => t.id !== 'home');
    if (filtered.length === 0) return null;
    return filtered.map(({ iconKey, ...rest }) => ({
      ...rest,
      icon: ICON_MAP[iconKey || 'chat'] || MessageCircle,
    }));
  } catch {
    return null;
  }
}

// Seed lastActivatedAt sequentially so left-most tabs are "older" than
// right-most ones; the user's first interaction will further refine the order.
const DEFAULT_BASELINE = 1_000_000;
const DEFAULT_TABS: Tab[] = [
  { id: 'p1', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat', lastActivatedAt: DEFAULT_BASELINE + 1 },
  { id: 'p2', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat', lastActivatedAt: DEFAULT_BASELINE + 2 },
  { id: 'p3', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat', lastActivatedAt: DEFAULT_BASELINE + 3 },
  { id: 'p4', title: '聊天', icon: MessageCircle, closeable: true, pinned: true, menuItemId: 'chat', lastActivatedAt: DEFAULT_BASELINE + 4 },
  { id: 't1', title: '聊天话题', icon: MessageCircle, closeable: true, menuItemId: 'chat', lastActivatedAt: DEFAULT_BASELINE + 5 },
  { id: 't2', title: '创作', icon: Palette, closeable: true, menuItemId: 'painting', lastActivatedAt: DEFAULT_BASELINE + 6 },
  { id: 't3', title: '工作', icon: MousePointerClick, closeable: true, menuItemId: 'agent', lastActivatedAt: DEFAULT_BASELINE + 7 },
  { id: 't4', title: '翻译', icon: Languages, closeable: true, menuItemId: 'translate', lastActivatedAt: DEFAULT_BASELINE + 8 },
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
    if (id && id !== 'home') return id;
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
  handleSidebarItemClick: (menuItemId: string, onAfter?: () => void) => void;
  handleDialogCreateTab: (menuItemId: string, onAfter?: () => void) => void;
  handleOpenMiniApp: (app: { id: string; name: string; color: string; initial: string; url: string; logoUrl?: string }) => void;
  handlePinTab: (tabId: string) => void;
  handleTabTitleChange: (title: string, tabId: string) => void;
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

  // Bump lastActivatedAt whenever the active tab changes — this is the source
  // of truth for sidebar "jump to most recent" and the visible/overflow split.
  // Done via effect so every setActiveTabId path (internal & external) is
  // captured without each caller having to remember to update the timestamp.
  useEffect(() => {
    if (!activeTabId) return;
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === activeTabId);
      if (idx === -1) return prev;
      // Avoid useless re-renders when value is already current (e.g. just
      // created with Date.now()).
      const now = Date.now();
      if ((prev[idx].lastActivatedAt ?? 0) === now) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], lastActivatedAt: now };
      return next;
    });
  }, [activeTabId]);

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
    const now = Date.now();
    const newId = `t${now}`;
    const newTab: Tab = {
      id: newId,
      title: menuItem.label,
      icon: menuItem.icon,
      closeable: true,
      menuItemId,
      lastActivatedAt: now,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  const createNewTab = useCallback(() => {
    const now = Date.now();
    const newId = `newtab-${now}`;
    const newTab: Tab = {
      id: newId,
      title: '新建标签页',
      icon: Sparkles,
      closeable: true,
      menuItemId: NEW_TAB_MENU_ID,
      lastActivatedAt: now,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, []);

  // Browser-like: selecting an item from the new-tab placeholder replaces the
  // current tab in-place (instead of stacking another). The current tab here
  // is by definition a blank placeholder (no menuItemId or NEW_TAB_MENU_ID),
  // so there's nothing to "lose" by mutating it.
  const replaceTabWithMenuItem = useCallback((tabId: string, menuItemId: string) => {
    const menuItem = menuItems.find(m => m.id === menuItemId);
    if (!menuItem) return;
    setTabs(prev => prev.map(t => t.id === tabId
      ? { ...t, title: menuItem.label, icon: menuItem.icon, menuItemId, lastActivatedAt: Date.now() }
      : t
    ));
    setActiveTabId(tabId);
  }, []);

  // Sidebar click — Model A: "module navigator", never destroys a tab.
  // (0) active tab is a blank placeholder      → replace in-place
  // (1) active tab is already module M         → no-op
  // (2) otherwise → find non-detached tabs of M (pinned counts);
  //      ≥1 → jump to lastActivatedAt-max one
  //       0 → create a new M tab (with new session)
  const handleSidebarItemClick = useCallback((menuItemId: string, onAfter?: () => void) => {
    const activeTab = tabs.find(t => t.id === activeTabId);

    // (0) blank placeholder → in-place upgrade
    const isBlankPlaceholder = activeTab
      && !activeTab.miniAppId
      && (!activeTab.menuItemId || activeTab.menuItemId === NEW_TAB_MENU_ID);
    if (isBlankPlaceholder && activeTab) {
      replaceTabWithMenuItem(activeTab.id, menuItemId);
      onAfter?.();
      return;
    }

    // (1) already on module M → no-op
    if (activeTab?.menuItemId === menuItemId && !activeTab.miniAppId) {
      onAfter?.();
      return;
    }

    // (2) find existing tabs of this module (detached doesn't count — those
    // are mentally "out of the tab bar")
    const candidates = tabs.filter(t =>
      t.menuItemId === menuItemId && !t.detached && !t.miniAppId
    );
    if (candidates.length > 0) {
      const mostRecent = candidates.reduce((acc, t) =>
        (t.lastActivatedAt ?? 0) > (acc.lastActivatedAt ?? 0) ? t : acc
      );
      setActiveTabId(mostRecent.id);
      onAfter?.();
      return;
    }

    createTabForMenuItem(menuItemId);
    onAfter?.();
  }, [tabs, activeTabId, createTabForMenuItem, replaceTabWithMenuItem]);

  // "+" / new-tab dialog → always creates a fresh tab. This is the explicit
  // "new" gesture, so it never reuses existing tabs (in contrast to the
  // sidebar, which is the "navigate to module" gesture).
  const handleDialogCreateTab = useCallback((menuItemId: string, onAfter?: () => void) => {
    createTabForMenuItem(menuItemId);
    onAfter?.();
  }, [createTabForMenuItem]);

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

  // Pages must pass their own tabId so this callback stays stable across
  // active-tab changes. Otherwise callers' useEffects (which include the
  // callback ref in deps) re-fire across all kept-alive pages, causing the
  // mounted-but-inactive page to clobber the now-active tab's title.
  const handleTabTitleChange = useCallback((title: string, tabId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, title } : t));
  }, []);

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
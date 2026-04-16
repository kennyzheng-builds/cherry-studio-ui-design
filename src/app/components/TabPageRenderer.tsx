import React from 'react';
import type { Tab } from '@/app/types';
import { useGlobalActions } from '@/app/context/GlobalActionContext';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { GenericPage } from './pages/GenericPage';
import { NewTabPage } from './pages/NewTabPage';
import { TranslatePage } from './TranslatePage';
import { NotePage } from './NotePage';
import { CodeToolPage } from './CodeToolPage';
import { KnowledgePage } from './KnowledgePage';
import { MiniAppsPage } from './MiniAppsPage';
import { MiniAppEmbedPage } from './MiniAppEmbedPage';
import { ExplorePage } from './ExplorePage';
import { LibraryPage } from './library/LibraryPage';
import { AgentRunPage } from './agent/run/AgentRunPage';
import { AssistantRunPage } from './assistant/AssistantRunPage';
import { ImagePage } from './image/ImagePage';
import { FilePage } from './file/FilePage';
import { ModelServicePage } from './settings/ModelServicePage';
import { ExtensionsPage } from '@/features/extensions/ExtensionsPage';

// ===========================
// Tab Page Renderer
// ===========================
// Maps a Tab's menuItemId (or mini-app flag) to the correct page component.
// Shared by MainContent (regular in-app tabs) and FloatingWindow (detached tabs
// living in their own popout window), so a detached tab renders the same content
// it had inside the main window.

export interface TabPageRendererProps {
  tab: Tab;
  isActive: boolean;
}

export const TabPageRenderer = React.memo(function TabPageRenderer({ tab, isActive }: TabPageRendererProps) {
  const actions = useGlobalActions();
  const menuItemId = tab.menuItemId;

  return (
    <ErrorBoundary>
      {menuItemId === 'newtab' ? (
          <NewTabPage
            onSelect={(id) => actions.replaceTabWithMenuItem(tab.id, id)}
            hiddenApps={actions.hiddenApps}
            setHiddenApps={actions.setHiddenApps}
            appOrder={actions.appOrder}
            setAppOrder={actions.setAppOrder}
          />
        )
        : menuItemId === 'chat' ? <AssistantRunPage initialTopicId={tab.topicId} />
        : menuItemId === 'agent' ? <AgentRunPage initialSessionId={tab.sessionId} />
        : menuItemId === 'models' ? <ModelServicePage />
        : menuItemId === 'painting' ? <ImagePage />
        : menuItemId === 'translate' ? <TranslatePage />
        : menuItemId === 'note' ? <NotePage />
        : menuItemId === 'code' ? <CodeToolPage />
        : menuItemId === 'knowledge' ? <KnowledgePage />
        : menuItemId === 'explore' ? <ExplorePage />
        : menuItemId === 'library' ? <LibraryPage />
        : menuItemId === 'file' ? <FilePage />
        : menuItemId === 'miniapp' ? <MiniAppsPage />
        : menuItemId === 'extensions' ? <ExtensionsPage />
        : tab.miniAppId ? <MiniAppEmbedPage tab={tab} />
        : <GenericPage tab={tab} />
      }
    </ErrorBoundary>
  );
});

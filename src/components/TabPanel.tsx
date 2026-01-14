import { ReactNode } from 'react';

/**
 * @file TabPanel.tsx
 * @description Specialized container component for displaying tabbed content with accessibility support.
 */

interface Tab {
    id: string;
    label: string;
    description?: string;
}

interface TabPanelProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    children: ReactNode;
}

/**
 * TabPanel component for displaying tabbed content
 */
const TabPanel = ({ tabs, activeTab, onTabChange, children }: TabPanelProps) => {
    return (
        <div className="tab-panel">
            <div className="tab-panel__header">
                <div className="tab-panel__tabs" role="tablist">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            className={`tab-panel__tab ${activeTab === tab.id ? 'tab-panel__tab--active' : ''}`}
                            onClick={() => onTabChange(tab.id)}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            aria-controls={`tabpanel-${tab.id}`}
                            id={`tab-${tab.id}`}
                        >
                            <span className="tab-panel__tab-label">{tab.label}</span>
                            {tab.description && (
                                <span className="tab-panel__tab-description">{tab.description}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="tab-panel__content"
                role="tabpanel"
                id={`tabpanel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
            >
                {children}
            </div>
        </div>
    );
};

export default TabPanel;

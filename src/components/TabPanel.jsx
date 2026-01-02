import React from 'react';
import PropTypes from 'prop-types';

/**
 * @fileoverview Tab panel component for switching between different processing modes.
 * Provides a clean tabbed interface with keyboard navigation support.
 */

/**
 * TabPanel component for displaying tabbed content
 * @param {Object} props - Component props
 * @param {Array} props.tabs - Array of tab objects with id and label
 * @param {string} props.activeTab - Currently active tab id
 * @param {Function} props.onTabChange - Callback when tab is changed
 * @param {React.ReactNode} props.children - Tab content to display
 * @returns {JSX.Element} TabPanel component
 */
const TabPanel = ({ tabs, activeTab, onTabChange, children }) => {
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

TabPanel.propTypes = {
    tabs: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            description: PropTypes.string
        })
    ).isRequired,
    activeTab: PropTypes.string.isRequired,
    onTabChange: PropTypes.func.isRequired,
    children: PropTypes.node.isRequired
};

export default TabPanel;

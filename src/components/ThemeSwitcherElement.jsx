import { useState, useEffect } from 'react';
import { THEME_CONFIG, THEME_SWITCH, BORDER_RADIUS, SPACING, SHADOWS, TRANSITIONS } from '../constants';

function ThemeSwitcherElement() {
    const [currentTheme, setCurrentTheme] = useState(THEME_CONFIG.DEFAULT);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem(THEME_CONFIG.STORAGE_KEY);

        if (savedTheme) {
            setCurrentTheme(savedTheme);
            applyTheme(savedTheme);
        } else {
            // Check system preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? THEME_CONFIG.DARK : THEME_CONFIG.LIGHT;
            setCurrentTheme(systemTheme);
            applyTheme(systemTheme);
        }

        setIsInitialized(true);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = (e) => {
            if (!localStorage.getItem(THEME_CONFIG.STORAGE_KEY)) {
                const newTheme = e.matches ? THEME_CONFIG.DARK : THEME_CONFIG.LIGHT;
                setCurrentTheme(newTheme);
                applyTheme(newTheme);
            }
        };

        mediaQuery.addEventListener('change', handleSystemThemeChange);
        return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }, []);

    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_CONFIG.STORAGE_KEY, theme);
    };

    const toggleTheme = () => {
        setIsAnimating(true);
        const newTheme = currentTheme === THEME_CONFIG.DARK ? THEME_CONFIG.LIGHT : THEME_CONFIG.DARK;
        setCurrentTheme(newTheme);
        applyTheme(newTheme);

        setTimeout(() => setIsAnimating(false), 800);
    };

    if (!isInitialized) {
        return null;
    }

    const isDarkMode = currentTheme === THEME_CONFIG.DARK;
    const iconClass = isDarkMode ? THEME_SWITCH.ICONS.LIGHT : THEME_SWITCH.ICONS.DARK;
    const tooltip = isDarkMode ? THEME_SWITCH.TOOLTIPS.LIGHT : THEME_SWITCH.TOOLTIPS.DARK;

    return (
        <>
            <style>{`
                .theme-switcher-container {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: ${SPACING.SM};
                }

                .theme-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    padding: 0;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: ${BORDER_RADIUS.MD};
                    color: var(--color-text-secondary);
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all ${TRANSITIONS.NORMAL} !important;
                    position: relative;
                    outline: none;
                }

                .theme-toggle-btn:hover {
                    background: var(--color-bg-tertiary) !important;
                    border-color: var(--border-color-hover) !important;
                    color: var(--color-text-primary) !important;
                    transform: translateY(-1px) !important;
                    box-shadow: ${SHADOWS.SM} !important;
                }

                .theme-toggle-btn:active {
                    transform: translateY(0) !important;
                    background: var(--color-bg-tertiary) !important;
                }

                .theme-toggle-btn:focus {
                    outline: 2px solid var(--color-primary) !important;
                    outline-offset: 2px !important;
                }

                .theme-icon {
                    transition: transform ${TRANSITIONS.SLOW} ease, opacity ${TRANSITIONS.NORMAL} !important;
                }

                .theme-icon.sun {
                    color: #fbbf24 !important;
                }

                .theme-icon.moon {
                    color: #f59e0b !important;
                }

                .theme-toggle-btn:hover .theme-icon.sun {
                    color: #fbbf24 !important;
                }

                .theme-toggle-btn:hover .theme-icon.moon {
                    color: #f59e0b !important;
                }

                .theme-tooltip {
                    position: absolute;
                    bottom: -35px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                    padding: 4px 8px;
                    border-radius: ${BORDER_RADIUS.SM};
                    font-size: 0.75rem;
                    white-space: nowrap;
                    opacity: 0;
                    visibility: hidden;
                    transition: all ${TRANSITIONS.NORMAL} !important;
                    pointer-events: none;
                    z-index: 1000;
                    border: 1px solid var(--border-color);
                    box-shadow: ${SHADOWS.MD};
                }

                .theme-toggle-btn:hover .theme-tooltip {
                    opacity: 1 !important;
                    visibility: visible !important;
                    bottom: -40px !important;
                }

                /* Animation for theme switch */
                @keyframes spin {
                    from {
                        transform: rotate(0deg) !important;
                    }
                    to {
                        transform: rotate(360deg) !important;
                    }
                }

                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1) !important;
                    }
                    50% {
                        transform: scale(1.1) !important;
                    }
                }

                .fa-spin {
                    animation: spin 1s linear infinite !important;
                }

                .theme-toggle-btn.animating .theme-icon {
                    animation: spin 0.5s ease-in-out !important, pulse 0.3s ease-in-out 0.5s !important;
                }

                /* Mobile responsive */
                @media (max-width: 768px) {
                    .theme-switcher-container {
                        margin-right: ${SPACING.XS} !important;
                    }

                    .theme-toggle-btn {
                        width: 32px !important;
                        height: 32px !important;
                        font-size: 0.9rem !important;
                    }

                    .theme-tooltip {
                        display: none !important;
                    }
                }

                @media (max-width: 480px) {
                    .theme-toggle-btn {
                        width: 30px !important;
                        height: 30px !important;
                        font-size: 0.85rem !important;
                    }
                }
            `}</style>

            <div className="theme-switcher-container">
                <button
                    className={`theme-toggle-btn ${isAnimating ? 'animating' : ''}`}
                    onClick={toggleTheme}
                    aria-label={tooltip}
                    title={tooltip}
                    role="switch"
                    aria-checked={isDarkMode}
                >
                    <i className={`${iconClass} theme-icon ${isDarkMode ? 'sun' : 'moon'}`}></i>
                    <span className="theme-tooltip">{tooltip}</span>
                </button>
            </div>
        </>
    );
}

export default ThemeSwitcherElement;
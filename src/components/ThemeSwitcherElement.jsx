import { useState, useEffect } from 'react';
import { THEME_CONFIG } from '../constants';
import {
    getInitialTheme,
    applyTheme,
    getOppositeTheme,
    createSystemThemeListener,
    getThemeIconClass,
    getThemeTooltip
} from '../utils';
import '../styles/ThemeSwitcherElement.css';

/**
 * ThemeSwitcherElement component for toggling between light and dark themes
 * @component
 * @returns {JSX.Element} Theme switcher component
 */
function ThemeSwitcherElement() {
    const [currentTheme, setCurrentTheme] = useState(() => getInitialTheme());
    const [isInitialized] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const initialTheme = getInitialTheme();
        // Skip setCurrentTheme here as it's set in initializer if local state matches.
        // Or if we want to enforce what's effectively in local storage:
        applyTheme(initialTheme);
        // setIsInitialized is handled in useState initializer

        const cleanup = createSystemThemeListener((newTheme) => {
            setCurrentTheme(newTheme);
            applyTheme(newTheme);
        });

        return cleanup;
    }, []);

    const handleThemeToggle = () => {
        setIsAnimating(true);
        const newTheme = getOppositeTheme(currentTheme);
        setCurrentTheme(newTheme);
        applyTheme(newTheme);

        setTimeout(() => setIsAnimating(false), 800);
    };

    if (!isInitialized) {
        return null;
    }

    const isDark = currentTheme === THEME_CONFIG.DARK;
    const iconClass = getThemeIconClass(currentTheme);
    const tooltip = getThemeTooltip(currentTheme);

    return (
        <div className="theme-switcher-container">
            <button
                className={`theme-toggle-btn ${isAnimating ? 'animating' : ''}`}
                onClick={handleThemeToggle}
                aria-label={tooltip}
                title={tooltip}
                role="switch"
                aria-checked={isDark}
            >
                <i className={`${iconClass} theme-icon ${isDark ? 'sun' : 'moon'}`}></i>
                <span className="theme-tooltip">{tooltip}</span>
            </button>
        </div>
    );
}

export default ThemeSwitcherElement;
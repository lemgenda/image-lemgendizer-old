import { useState, useEffect } from 'react';
import { THEME_CONFIG } from '../constants';
import type { Theme } from '../types';
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
 * @returns Theme switcher component
 */
function ThemeSwitcherElement() {
    const [currentTheme, setCurrentTheme] = useState<Theme>(() => getInitialTheme());
    const [isInitialized] = useState<boolean>(true);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);

    useEffect(() => {
        const initialTheme = getInitialTheme();
        applyTheme(initialTheme);

        const cleanup = createSystemThemeListener((newTheme: Theme) => {
            setCurrentTheme(newTheme);
            applyTheme(newTheme);
        });

        return cleanup;
    }, []);

    const handleThemeToggle = (): void => {
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

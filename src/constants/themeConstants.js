// themeConstants.js - Theme colors and styling constants ONLY

// ================================
// Theme Configuration
// ================================

export const THEME_CONFIG = {
    DARK: 'dark',
    LIGHT: 'light',
    DEFAULT: 'dark',
    STORAGE_KEY: 'app-theme'
};

// ================================
// Color Theme Constants
// ================================

export const THEME_COLORS = {
    DARK: {
        bgPrimary: '#0f172a',
        bgSecondary: '#1e293b',
        bgTertiary: '#334155',
        textPrimary: '#f1f5f9',
        textSecondary: '#cbd5e1',
        textMuted: '#94a3b8',
        border: '#334155',
        borderHover: '#475569',
        themeIcon: '#fbbf24',
        themeToggleBg: '#1e293b',
        themeToggleBorder: '#475569'
    },
    LIGHT: {
        bgPrimary: '#ffffff',
        bgSecondary: '#f8fafc',
        bgTertiary: '#e2e8f0',
        textPrimary: '#1e293b',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: '#e2e8f0',
        borderHover: '#cbd5e1',
        themeIcon: '#f59e0b',
        themeToggleBg: '#ffffff',
        themeToggleBorder: '#e2e8f0'
    }
};

// ================================
// Helper Functions
// ================================

export const getCurrentTheme = () => {
    if (typeof window !== 'undefined') {
        const storedTheme = localStorage.getItem(THEME_CONFIG.STORAGE_KEY);
        return storedTheme || THEME_CONFIG.DEFAULT;
    }
    return THEME_CONFIG.DEFAULT;
};

export const getThemeColor = (colorKey, theme = null) => {
    const currentTheme = theme || getCurrentTheme();
    const themeObj = THEME_COLORS[currentTheme.toUpperCase()] || THEME_COLORS.LIGHT;

    const keys = colorKey.split('.');
    let value = themeObj;

    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return themeObj.bgPrimary; // Fallback
        }
    }

    return value || themeObj.bgPrimary;
};

export const getThemeColors = (theme = null) => {
    const currentTheme = theme || getCurrentTheme();
    return THEME_COLORS[currentTheme.toUpperCase()] || THEME_COLORS.LIGHT;
};

// ================================
// Image Color Mapping for Themes
// ================================

export const getImageThemeColor = (colorKey) => {
    const theme = getCurrentTheme();
    const isDark = theme === 'dark';

    // Map image color keys to theme-specific colors
    const imageThemeColors = {
        'error.background': isDark ? '#7f1d1d' : '#f8d7da',
        'error.border': isDark ? '#991b1b' : '#f5c6cb',
        'error.text': isDark ? '#fecaca' : '#721c24',
        'warning.text': isDark ? '#fde68a' : '#856404',
        'placeholder.background': isDark ? '#1e293b' : '#f8f9fa',
        'placeholder.border': isDark ? '#334155' : '#dee2e6',
        'placeholder.text': isDark ? '#94a3b8' : '#495057',
        'default.background': isDark ? '#0f172a' : '#ffffff',
        'bg.primary': isDark ? '#0f172a' : '#ffffff',
        'bg.secondary': isDark ? '#1e293b' : '#f8fafc',
        'text.primary': isDark ? '#f1f5f9' : '#1e293b',
        'text.secondary': isDark ? '#cbd5e1' : '#475569'
    };

    return imageThemeColors[colorKey] || getThemeColor(colorKey);
};

// ================================
// Theme Switch Component Constants
// ================================

export const THEME_SWITCH = {
    ICONS: {
        DARK: 'fas fa-moon',
        LIGHT: 'fas fa-sun'
    },
    LABELS: {
        DARK: 'Dark Mode',
        LIGHT: 'Light Mode'
    },
    TOOLTIPS: {
        DARK: 'Switch to light mode',
        LIGHT: 'Switch to dark mode'
    }
};

// ================================
// Status Colors
// ================================

export const STATUS_COLORS = {
    SUCCESS: '#10b981',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',
    INFO: '#0ea5e9',
    PRIMARY: '#3b82f6',
    PRIMARY_HOVER: '#2563eb'
};

// ================================
// Component Sizing
// ================================

export const COMPONENT_SIZES = {
    BUTTON: {
        SM: { padding: 'var(--space-xs) var(--space-sm)', fontSize: '0.75rem' },
        MD: { padding: 'var(--space-sm) var(--space-md)', fontSize: '0.875rem' },
        LG: { padding: 'var(--space-md) var(--space-lg)', fontSize: '1rem' }
    },
    CARD: {
        PADDING: 'var(--space-lg)',
        BORDER_RADIUS: 'var(--radius-lg)',
        BORDER: '1px solid var(--border-color)'
    },
    INPUT: {
        PADDING: 'var(--space-sm) var(--space-md)',
        BORDER_RADIUS: 'var(--radius-md)',
        BORDER: '1px solid var(--border-color)'
    }
};
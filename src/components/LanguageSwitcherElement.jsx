import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_LANGUAGES, DEFAULT_LANGUAGE, SPACING, BORDER_RADIUS, SHADOWS, TRANSITIONS } from '../constants';

function LanguageSwitcherElement() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);

    // Create languages array with flags
    const languages = AVAILABLE_LANGUAGES.map(lang => ({
        code: lang.code,
        name: lang.name,
        flag: lang.code === 'en' ? '🇺🇸' : '🇭🇷' // Add flags based on language code
    }));

    useEffect(() => {
        const lang = localStorage.getItem('app-language') || DEFAULT_LANGUAGE;
        setCurrentLanguage(lang);
        i18n.changeLanguage(lang);
    }, [i18n]);

    const changeLanguage = (langCode) => {
        setCurrentLanguage(langCode);
        i18n.changeLanguage(langCode);
        localStorage.setItem('app-language', langCode);
        setIsOpen(false);
    };

    const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

    return (
        <>
            <style>{`
                .language-switcher-container {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                }

                .language-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px ${SPACING.SM};
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: ${BORDER_RADIUS.MD};
                    color: var(--color-text-primary);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all ${TRANSITIONS.NORMAL} !important;
                    min-width: 100px;
                    outline: none;
                }

                .language-toggle-btn:hover {
                    background: var(--color-bg-tertiary) !important;
                    border-color: var(--border-color-hover) !important;
                }

                .language-toggle-btn.open {
                    border-radius: ${BORDER_RADIUS.MD} ${BORDER_RADIUS.MD} 0 0 !important;
                    border-bottom-color: transparent !important;
                }

                .language-flag {
                    font-size: 16px;
                    margin-right: 8px;
                }

                .language-code {
                    flex: 1;
                    margin: 0 8px;
                }

                .language-arrow {
                    font-size: 12px;
                    color: var(--color-text-muted);
                    transition: transform ${TRANSITIONS.NORMAL} !important;
                }

                .language-arrow.open {
                    transform: rotate(180deg) !important;
                }

                .language-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--border-color);
                    border-top: none;
                    border-radius: 0 0 ${BORDER_RADIUS.MD} ${BORDER_RADIUS.MD};
                    box-shadow: ${SHADOWS.MD};
                    z-index: 1001;
                    min-width: 100px;
                }

                .language-option-btn {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: ${SPACING.SM} ${SPACING.MD};
                    background: transparent;
                    border: none;
                    color: var(--color-text-secondary);
                    font-size: 14px;
                    cursor: pointer;
                    transition: all ${TRANSITIONS.NORMAL} !important;
                }

                .language-option-btn:hover {
                    background: var(--color-bg-tertiary) !important;
                    color: var(--color-text-primary) !important;
                }

                .language-option-btn.active {
                    background: rgba(59, 130, 246, 0.1) !important;
                    color: var(--color-primary) !important;
                    font-weight: 500;
                }

                .language-option-btn:not(:last-child) {
                    border-bottom: 1px solid var(--border-color);
                }

                .language-dropdown-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 1000;
                }

                /* Mobile responsive */
                @media (max-width: 768px) {
                    .language-toggle-btn {
                        min-width: 80px !important;
                        padding: 6px 10px !important;
                    }

                    .language-code {
                        display: none !important;
                    }

                    .language-option-btn .language-name {
                        display: block !important;
                    }
                }

                @media (max-width: 480px) {
                    .language-toggle-btn {
                        min-width: 70px !important;
                        padding: 5px 8px !important;
                        font-size: 13px !important;
                    }

                    .language-flag {
                        font-size: 14px !important;
                        margin-right: 6px !important;
                    }

                    .language-arrow {
                        font-size: 10px !important;
                    }
                }
            `}</style>

            <div className="language-switcher-container">
                <button
                    className={`language-toggle-btn ${isOpen ? 'open' : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Select language"
                    aria-expanded={isOpen}
                >
                    <span className="language-flag">{currentLang.flag}</span>
                    <span className="language-code">{currentLang.code.toUpperCase()}</span>
                    <i
                        className={`fas fa-chevron-down language-arrow ${isOpen ? 'open' : ''}`}
                    ></i>
                </button>

                {isOpen && (
                    <div className="language-dropdown-menu">
                        {languages.map((lang) => (
                            <button
                                key={lang.code}
                                className={`language-option-btn ${lang.code === currentLanguage ? 'active' : ''}`}
                                onClick={() => changeLanguage(lang.code)}
                            >
                                <span className="language-flag">{lang.flag}</span>
                                <span className="language-name" style={{ flex: '1', textAlign: 'left' }}>
                                    {lang.name}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {isOpen && (
                    <div
                        className="language-dropdown-overlay"
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </div>
        </>
    );
}

export default LanguageSwitcherElement;
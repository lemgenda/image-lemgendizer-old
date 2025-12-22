import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getLanguages, getCurrentLanguage } from '../utils';

/**
 * A dropdown component for switching between application languages.
 */
function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = getLanguages();
    const currentLanguage = getCurrentLanguage(i18n.language);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            <style>{`
                .language-switcher-relative {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                }

                .language-dropdown-wrapper {
                    position: relative;
                }

                .language-toggle-btn {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 16px;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    color: var(--color-text-primary);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                    min-width: 120px;
                }

                .language-toggle-btn:hover {
                    background: var(--color-bg-tertiary);
                    border-color: var(--border-color-hover);
                }

                .language-toggle-btn.active {
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                    border-bottom-color: transparent;
                }

                .language-flag {
                    font-size: 16px;
                }

                .language-name-text {
                    margin: 0 8px;
                    flex: 1;
                }

                .language-arrow {
                    font-size: 12px;
                    color: var(--color-text-muted);
                    transition: transform var(--transition-fast);
                }

                .language-arrow.open {
                    transform: rotate(180deg);
                }

                .language-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: var(--color-bg-secondary);
                    border: 1px solid var(--border-color);
                    border-top: none;
                    border-radius: 0 0 var(--radius-md) var(--radius-md);
                    box-shadow: var(--shadow-md);
                    z-index: 1001;
                    min-width: 120px;
                }

                .language-option-btn {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    padding: 10px 16px;
                    background: none;
                    border: none;
                    color: var(--color-text-secondary);
                    font-size: 14px;
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }

                .language-option-btn:hover {
                    background: var(--color-bg-tertiary);
                    color: var(--color-text-primary);
                }

                .language-option-btn.active {
                    background: rgba(59, 130, 246, 0.1);
                    color: var(--color-primary);
                    font-weight: 500;
                }

                .language-option-btn:not(:last-child) {
                    border-bottom: 1px solid var(--border-color);
                }

                /* Mobile adjustments */
                @media (max-width: 768px) {
                    .language-switcher-relative {
                        top: 15px;
                        right: 15px;
                    }

                    .language-toggle-btn {
                        min-width: 100px;
                        padding: 6px 12px;
                    }

                    .language-name-text {
                        display: none;
                    }

                    .language-option-btn .language-name-text {
                        display: block;
                    }
                }

                @media (max-width: 480px) {
                    .language-switcher-relative {
                        top: 10px;
                        right: 10px;
                    }

                    .language-toggle-btn {
                        min-width: 80px;
                    }

                    .language-flag {
                        font-size: 14px;
                    }
                }
            `}</style>

            <div className="language-switcher-relative" ref={dropdownRef}>
                <div className="language-dropdown-wrapper">
                    <button
                        className={`language-toggle-btn ${isOpen ? 'active' : ''}`}
                        onClick={() => setIsOpen(!isOpen)}
                        aria-expanded={isOpen}
                        aria-label="Select language"
                    >
                        <span className="language-flag">{currentLanguage.flag}</span>
                        <span className="language-name-text">{currentLanguage.name}</span>
                        <span className={`language-arrow ${isOpen ? 'open' : ''}`}>
                            <i className="fas fa-chevron-down"></i>
                        </span>
                    </button>

                    {isOpen && (
                        <div className="language-dropdown-menu">
                            {languages.map(lang => (
                                <button
                                    key={lang.code}
                                    className={`language-option-btn ${i18n.language === lang.code ? 'active' : ''}`}
                                    onClick={() => {
                                        i18n.changeLanguage(lang.code);
                                        setIsOpen(false);
                                    }}
                                    aria-label={`Switch to ${lang.name}`}
                                >
                                    <span className="language-flag">{lang.flag}</span>
                                    <span className="language-name-text">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default LanguageSwitcher;
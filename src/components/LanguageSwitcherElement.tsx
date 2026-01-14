/**
 * @file LanguageSwitcherElement.tsx
 * @description UI component for selecting and switching the application language.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageInfo } from '../utils/languageUtils';
import {
    getLanguagesWithFlags,
    getCurrentLanguage,
    changeApplicationLanguage,
    getCurrentLanguageObject,
    initializeLanguage
} from '../utils';
import '../styles/LanguageSwitcherElement.css';

/**
 * LanguageSwitcherElement component for switching between available languages
 * @component
 * @returns Language switcher component
 */
function LanguageSwitcherElement() {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
        const lang = initializeLanguage(i18n);
        return lang || getCurrentLanguage();
    });

    const languages: LanguageInfo[] = getLanguagesWithFlags();

    useEffect(() => {
        // lang is initialized in useState
    }, [i18n]);

    const handleLanguageChange = (langCode: string): void => {
        setCurrentLanguage(langCode);
        changeApplicationLanguage(langCode, i18n);
        setIsOpen(false);
    };

    const currentLang: LanguageInfo = getCurrentLanguageObject(currentLanguage);

    return (
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
                            onClick={() => handleLanguageChange(lang.code)}
                        >
                            <span className="language-flag">{lang.flag}</span>
                            <span className="language-name">
                                {lang.name}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {isOpen && (
                <div
                    className="language-dropdown-overlay"
                    role="button"
                    tabIndex={0}
                    aria-label="Close language menu"
                    onClick={() => setIsOpen(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(false); }}
                />
            )}
        </div>
    );
}

export default LanguageSwitcherElement;

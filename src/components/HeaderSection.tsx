/**
 * @file HeaderSection.tsx
 * @description Application header component containing the logo, title, and global controls (theme/language).
 */
import { useTranslation } from 'react-i18next';
import LanguageSwitcherElement from './LanguageSwitcherElement';
import LemGendaIconElement from './LemGendaIconElement';
import ThemeSwitcherElement from './ThemeSwitcherElement';
import AIEnhancementsBar from './AIEnhancementsBar';
import '../styles/HeaderSection.css';

/**
 * HeaderSection component.
 * @component
 * @returns {JSX.Element} The rendered header.
 */
function HeaderSection() {
    const { t } = useTranslation();

    return (
        <header className="app-header">
            <div className="app-header-logo">
                <LemGendaIconElement className="header-icon" />
                <div className="header-title">
                    <h1>{t('app.title')}</h1>
                    <p className="app-subtitle">{t('app.subtitle')}</p>
                </div>
            </div>
            <div className="header-right">
                <AIEnhancementsBar />
                <ThemeSwitcherElement />
                <LanguageSwitcherElement />
            </div>
        </header>
    );
}

export default HeaderSection;

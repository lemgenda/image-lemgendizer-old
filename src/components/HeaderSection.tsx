import { useTranslation } from 'react-i18next';
import LanguageSwitcherElement from './LanguageSwitcherElement';
import LemGendaIconElement from './LemGendaIconElement';
import ThemeSwitcherElement from './ThemeSwitcherElement';
import '../styles/HeaderSection.css';

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
                <ThemeSwitcherElement />
                <LanguageSwitcherElement />
            </div>
        </header>
    );
}

export default HeaderSection;

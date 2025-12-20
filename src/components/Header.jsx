import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import lemGendaIcon from '../assets/lemgenda-icon.svg';

function Header() {
    const { t } = useTranslation();

    return (
        <>
            <style>{`
                .app-header {
                    text-align: center;
                    padding-bottom: var(--space-lg);
                    border-bottom: 1px solid var(--border-color);
                    position: relative;
                }

                .app-header-logo {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--space-lg);
                    margin-bottom: var(--space-sm);
                }

                .header-icon {
                    width: 60px;
                    height: 60px;
                }

                .header-title h1 {
                    color: var(--color-primary);
                    margin-bottom: var(--space-xs);
                }

                .app-subtitle {
                    color: var(--color-text-muted);
                    font-size: 1rem;
                    font-weight: 400;
                }

                /* Mobile adjustments */
                @media (max-width: 480px) {
                    .app-header-logo {
                        flex-direction: column;
                        text-align: center;
                        gap: var(--space-md);
                    }
                }
            `}</style>

            <header className="app-header">
                <div className="app-header-logo">
                    <img
                        src={lemGendaIcon}
                        alt="LemGenda Icon"
                        className="header-icon"
                    />
                    <div className="header-title">
                        <h1>{t('app.title')}</h1>
                        <p className="app-subtitle">{t('app.subtitle')}</p>
                    </div>
                </div>
                <LanguageSwitcher />
            </header>
        </>
    );
}

export default Header;
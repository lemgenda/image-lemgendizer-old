import { useTranslation } from 'react-i18next';
import LanguageSwitcherElement from './LanguageSwitcherElement';
import LemGendaIconElement from './LemGendaIconElement';
import ThemeSwitcherElement from './ThemeSwitcherElement';
import { FONT_CONSTANTS, SPACING } from '../constants';

function HeaderSection() {
    const { t } = useTranslation();

    return (
        <>
            <style>{`
                .app-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: ${SPACING.LG} 0;
                    border-bottom: 1px solid var(--border-color);
                    position: relative;
                }

                .app-header-logo {
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.LG};
                }

                .header-icon {
                    width: 80px;
                    height: 80px;
                    flex-shrink: 0;
                    color: var(--color-primary);
                }

                .header-title {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .header-title h1 {
                    color: var(--color-primary);
                    margin: 0;
                    font-size: ${FONT_CONSTANTS.HEADLINE_FONT_SIZE * 0.75}px;
                    line-height: 1.2;
                }

                .app-subtitle {
                    color: var(--color-text-muted);
                    font-size: ${FONT_CONSTANTS.BODY_FONT_SIZE}px;
                    font-weight: 400;
                    margin-top: ${SPACING.XS};
                    margin-bottom: 0;
                }

                .header-right {
                    display: flex;
                    align-items: center;
                    gap: ${SPACING.SM};
                }

                @media (max-width: 768px) {
                    .app-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: ${SPACING.MD};
                    }

                    .app-header-logo {
                        justify-content: center;
                        text-align: center;
                    }

                    .header-title h1 {
                        font-size: ${FONT_CONSTANTS.HEADLINE_FONT_SIZE * 0.67}px;
                    }

                    .header-icon {
                        width: 60px;
                        height: 60px;
                    }

                    .header-right {
                        position: absolute;
                        top: ${SPACING.MD};
                        right: 0;
                        gap: ${SPACING.XS};
                    }
                }

                @media (max-width: 480px) {
                    .app-header-logo {
                        flex-direction: column;
                        gap: ${SPACING.MD};
                    }

                    .header-title {
                        text-align: center;
                    }

                    .header-title h1 {
                        font-size: ${FONT_CONSTANTS.HEADLINE_FONT_SIZE * 0.58}px;
                    }

                    .header-icon {
                        width: 50px;
                        height: 50px;
                    }

                    .header-right {
                        top: ${SPACING.SM};
                        gap: ${SPACING.XS};
                    }
                }
            `}</style>

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
        </>
    );
}

export default HeaderSection;
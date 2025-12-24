import { useTranslation } from 'react-i18next';
import LemGendaLogo from './LemGendaLogo';

/**
 * Footer component displaying application information and logo
 * @returns {JSX.Element} Footer component
 */
function Footer() {
    const { t } = useTranslation();

    return (
        <>
            <style>{`
                .app-footer {
                    margin-top: var(--space-sm);
                    color: var(--color-text-muted);
                    padding-top: var(--space-xs);
                    border-top: 1px solid var(--border-color);
                    font-size: 0.875rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: var(--space-lg);
                }

                .footer-left {
                    text-align: left;
                    flex: 1;
                    min-width: 200px;
                }

                .footer-right {
                    text-align: right;
                    flex: 1;
                    min-width: 200px;
                }

                .footer-logo-container {
                    margin-bottom: var(--space-xs);
                }

                .footer-logo {
                    height: 30px;
                    opacity: 0.8;
                    transition: opacity var(--transition-fast);
                    color: var(--color-primary);
                }

                .footer-logo:hover {
                    opacity: 1;
                }

                .footer-text {
                    margin-bottom: var(--space-xs);
                }

                .text-muted {
                    color: var(--color-text-muted);
                }

                .mb-xs {
                    margin-bottom: var(--space-xs);
                }

                .mt-xs {
                    margin-top: var(--space-xs);
                }

                .text-sm {
                    font-size: 0.8125rem;
                }

                .inline-block {
                    display: inline-block;
                }

                @media (max-width: 768px) {
                    .app-footer {
                        flex-direction: column;
                        text-align: center;
                        gap: var(--space-md);
                    }

                    .footer-left,
                    .footer-right {
                        text-align: center;
                        width: 100%;
                    }
                }
            `}</style>

            <footer className="app-footer">
                <div className="footer-left">
                    <div className="footer-text">
                        <p className="text-muted text-sm mb-xs">
                            <i className="fas fa-shield-alt"></i> {t('app.imagesNeverLeave')}
                        </p>
                        <p className="text-muted text-sm mb-xs">
                            <i className="fas fa-brain"></i> {t('footer.aiEnabled')}
                        </p>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="footer-logo-container">
                        <p className="text-muted mb-xs">{t('app.version')}</p>
                        <a
                            href="https://lemgenda.hr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                        >
                            <LemGendaLogo className="footer-logo" />
                        </a>
                    </div>
                </div>
            </footer>
        </>
    );
}

export default Footer;
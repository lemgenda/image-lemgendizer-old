import { useTranslation } from 'react-i18next';
import lemGendaLogo from '../assets/lemgenda-logo.svg';

function Footer() {
    const { t } = useTranslation();

    return (
        <>
            <style>{`
                .app-footer {
                    margin-top: var(--space-xl);
                    color: var(--color-text-muted);
                    padding-top: var(--space-lg);
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
                    margin-bottom: var(--space-md);
                }

                .footer-logo {
                    height: 30px;
                    opacity: 0.8;
                    transition: opacity var(--transition-fast);
                }

                .footer-logo:hover {
                    opacity: 1;
                }

                .footer-text {
                    margin-bottom: var(--space-xs);
                }

                /* Mobile adjustments */
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
                    <div className="footer-logo-container">
                        <p className="text-muted mb-xs">{t('footer.createdBy')}</p>
                        <a
                            href="https://lemgenda.hr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                        >
                            <img
                                src={lemGendaLogo}
                                alt="LemGenda Logo"
                                className="footer-logo"
                            />
                        </a>
                    </div>
                </div>

                <div className="footer-right">
                    <div className="footer-text">
                        <p className="text-muted">{t('app.version')} - {t('app.processClientSide')}</p>
                        <p className="text-muted text-sm mt-xs">
                            <i className="fas fa-shield-alt"></i> {t('app.imagesNeverLeave')}
                        </p>
                        <p className="text-muted text-sm mt-xs">
                            <i className="fas fa-brain"></i> {t('footer.aiEnabled')}
                        </p>
                    </div>
                </div>
            </footer>
        </>
    );
}

export default Footer;
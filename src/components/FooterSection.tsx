import { useTranslation } from 'react-i18next';
import LemGendaLogoElement from './LemGendaLogoElement';
import '../styles/FooterSection.css';

function FooterSection() {
    const { t } = useTranslation();

    return (
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
                        <LemGendaLogoElement className="footer-logo" />
                    </a>
                </div>
            </div>
        </footer>
    );
}

export default FooterSection;

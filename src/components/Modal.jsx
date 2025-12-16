import '../styles/App.css'
import { useTranslation } from 'react-i18next';

function Modal({ isOpen, onClose, title, children, actions }) {
    const { t } = useTranslation();

    if (!isOpen) return null

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose} aria-label={t('button.close')}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {actions && (
                    <div className="modal-actions">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Modal
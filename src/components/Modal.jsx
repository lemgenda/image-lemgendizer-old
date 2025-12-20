import { useTranslation } from 'react-i18next';

/**
 * A reusable modal dialog component.
 */
function Modal({ isOpen, onClose, title, children, actions }) {
    const { t } = useTranslation();

    if (!isOpen) return null

    return (
        <>
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background-color: var(--color-bg-secondary);
                    border-radius: var(--radius-lg);
                    padding: var(--space-xl);
                    width: 90%;
                    max-width: 500px;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.5);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-lg);
                    padding-bottom: var(--space-md);
                    border-bottom: 1px solid var(--border-color);
                }

                .modal-header h2 {
                    color: var(--color-text-primary);
                    font-size: 1.5rem;
                    margin: 0;
                }

                .modal-close {
                    background: none;
                    border: none;
                    color: var(--color-text-muted);
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: var(--space-xs);
                    border-radius: var(--radius-sm);
                    transition: all var(--transition-fast);
                }

                .modal-close:hover {
                    color: var(--color-text-primary);
                    background-color: var(--color-bg-tertiary);
                }

                .modal-body {
                    margin-bottom: var(--space-xl);
                    color: var(--color-text-secondary);
                    line-height: 1.6;
                }

                .modal-actions {
                    text-align: right;
                }

                @media (max-width: 768px) {
                    .modal-content {
                        padding: var(--space-lg);
                        width: 95%;
                    }
                }
            `}</style>

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
        </>
    )
}

export default Modal
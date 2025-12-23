import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A reusable modal dialog component with click-outside-to-close functionality.
 */
function Modal({ isOpen, onClose, title, children, actions, type = 'info' }) {
    const { t } = useTranslation();
    const modalRef = useRef(null);
    const overlayRef = useRef(null);

    /**
     * Handle click outside modal
     * @param {MouseEvent} e - Click event
     */
    const handleClickOutside = (e) => {
        if (
            overlayRef.current &&
            overlayRef.current.contains(e.target) &&
            modalRef.current &&
            !modalRef.current.contains(e.target)
        ) {
            onClose();
        }
    };

    /**
     * Handle ESC key press
     * @param {KeyboardEvent} e - Keyboard event
     */
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    /**
     * Add event listeners when modal opens
     */
    useEffect(() => {
        if (isOpen) {
            // Add click outside listener
            document.addEventListener('mousedown', handleClickOutside);
            // Add ESC key listener
            document.addEventListener('keydown', handleEscKey);
            // Prevent body scrolling
            document.body.style.overflow = 'hidden';
        }

        // Cleanup function
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]); // Only re-run if isOpen changes

    if (!isOpen) return null;

    // Determine modal class based on type
    const modalClass = `modal ${type}`;

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
                    animation: fadeIn 0.3s ease-out;
                }

                .modal-content {
                    background-color: var(--color-bg-secondary);
                    border-radius: var(--radius-lg);
                    padding: var(--space-xl);
                    width: 90%;
                    max-width: 500px;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 20px 25px rgba(0, 0, 0, 0.5);
                    animation: slideIn 0.3s ease-out;
                    transform-origin: center;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal.summary .modal-content {
                    width: 100vw;
                    height:100vh;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-lg);
                    padding-bottom: var(--space-md);
                    border-bottom: 1px solid var(--border-color);
                    position: relative;
                }

                .modal-header h2 {
                    color: var(--color-text-primary);
                    font-size: 1.5rem;
                    margin: 0;
                    padding-right: var(--space-xl);
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
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .modal-close:hover {
                    color: var(--color-text-primary);
                    background-color: var(--color-bg-tertiary);
                    transform: scale(1.1);
                }

                .modal-close:active {
                    transform: scale(0.95);
                }

                .modal-body {
                    margin-bottom: var(--space-xl);
                    color: var(--color-text-secondary);
                    line-height: 1.6;
                    animation: fadeInUp 0.4s ease-out 0.1s both;
                }

                .modal-actions {
                    text-align: right;
                    animation: fadeInUp 0.4s ease-out 0.2s both;
                }

                /* Modal Types */
                .modal.success .modal-header {
                    border-bottom-color: var(--success);
                }

                .modal.success .modal-header h2 {
                    color: var(--success);
                }

                .modal.error .modal-header {
                    border-bottom-color: var(--danger);
                }

                .modal.error .modal-header h2 {
                    color: var(--danger);
                }

                .modal.info .modal-header {
                    border-bottom-color: var(--info);
                }

                .modal.info .modal-header h2 {
                    color: var(--info);
                }

                .modal.summary .modal-header {
                    border-bottom-color: var(--primary);
                }

                .modal.summary .modal-header h2 {
                    color: var(--primary);
                }

                /* Animations */
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-30px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .modal-content {
                        padding: var(--space-lg);
                        width: 95%;
                        margin: var(--space-sm);
                    }

                    .modal.summary .modal-content {
                        max-width: 95%;
                    }

                    .modal-header h2 {
                        font-size: 1.25rem;
                    }

                    .modal-close {
                        top: -4px;
                        right: -4px;
                        width: 32px;
                        height: 32px;
                    }
                }

                @media (max-width: 480px) {
                    .modal-content {
                        padding: var(--space-md);
                    }

                    .modal-header {
                        margin-bottom: var(--space-md);
                        padding-bottom: var(--space-sm);
                    }

                    .modal-header h2 {
                        font-size: 1.1rem;
                    }

                    .modal-body {
                        margin-bottom: var(--space-lg);
                        font-size: 0.95rem;
                    }

                    .modal-close {
                        font-size: 1rem;
                    }
                }

                /* Focus styles for accessibility */
                .modal-close:focus {
                    outline: 2px solid var(--primary);
                    outline-offset: 2px;
                }

                /* Prevent content from being hidden behind keyboard on mobile */
                @media (max-height: 600px) {
                    .modal-overlay {
                        align-items: flex-start;
                        padding-top: var(--space-lg);
                    }

                    .modal-content {
                        max-height: calc(100vh - 40px);
                        overflow-y: auto;
                    }
                }
            `}</style>

            <div
                className="modal-overlay"
                ref={overlayRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                <div
                    className={modalClass}
                    ref={modalRef}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 id="modal-title">{title}</h2>
                            <button
                                className="modal-close"
                                onClick={onClose}
                                aria-label={t('button.close')}
                            >
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
            </div>
        </>
    )
}

export default Modal;
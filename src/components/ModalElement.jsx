import { useEffect } from 'react';
import {
    SPACING,
    BORDER_RADIUS,
    SHADOWS,
    TRANSITIONS,
    MODAL_TYPES
} from '../constants/sharedConstants';

function ModalElement({
    isOpen,
    onClose,
    title,
    children,
    type = MODAL_TYPES.INFO,
    onInteraction,
    actions
}) {
    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && isOpen) {
                if (onInteraction) onInteraction();
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
            // Prevent body scrolling when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, onInteraction]);

    // Handle interaction (user clicked/touched the modal)
    const handleInteraction = () => {
        if (onInteraction) {
            onInteraction();
        }
    };

    // Prevent event bubbling
    const handleModalClick = (e) => {
        e.stopPropagation();
        handleInteraction();
    };

    // Handle overlay click (close modal)
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleInteraction();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <style>{`
                /* Modal Overlay */
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
                    padding: ${SPACING?.MD || '1rem'};
                    opacity: 0;
                    visibility: hidden;
                    transition: all ${TRANSITIONS?.MEDIUM || '0.3s'};
                }

                .modal-overlay.active {
                    opacity: 1;
                    visibility: visible;
                }

                /* Modal Container - Consistent width for all modals */
                .modal-container {
                    background-color: var(--color-bg-secondary);
                    border-radius: ${BORDER_RADIUS?.LG || '0.75rem'};
                    width: 500px; /* Fixed width */
                    max-width: 90vw; /* Responsive but consistent */
                    border: 1px solid var(--border-color);
                    box-shadow: ${SHADOWS?.XL || '0 20px 25px rgba(0, 0, 0, 0.5)'};
                    animation: slideIn 0.3s ease-out;
                    transform-origin: center;
                    max-height: 90vh;
                    overflow: hidden;
                    transform: translateY(-20px);
                    transition: transform ${TRANSITIONS?.MEDIUM || '0.3s'};
                }

                .modal-overlay.active .modal-container {
                    transform: translateY(0);
                }

                /* Modal Content Area */
                .modal-content {
                    padding: var(--space-xl);
                    overflow-y: auto;
                    max-height: calc(90vh - 120px); /* Account for header/footer */
                }

                /* Modal Header */
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: ${SPACING?.LG || '1.5rem'} ${SPACING?.XL || '2rem'};
                    border-bottom: 1px solid var(--border-color);
                    background-color: var(--color-bg-secondary);
                    position: relative;
                }

                .modal-header h2 {
                    color: var(--color-text-primary);
                    font-size: 1.5rem;
                    margin: 0;
                    padding-right: ${SPACING?.XL || '2rem'};
                    flex: 1;
                }

                /* Modal Close Button */
                .modal-close {
                    background: none;
                    border: none;
                    color: var(--color-text-muted);
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: ${SPACING?.XS || '0.5rem'};
                    border-radius: ${BORDER_RADIUS?.SM || '0.25rem'};
                    transition: all var(--transition-fast);
                    position: absolute;
                    top: 16px;
                    right: 16px;
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

                .modal-close:focus {
                    outline: 2px solid var(--color-primary);
                    outline-offset: 2px;
                }

                /* Modal Body */
                .modal-body {
                    margin-bottom: ${SPACING?.XL || '2rem'};
                    color: var(--color-text-secondary);
                    line-height: 1.6;
                    animation: fadeInUp 0.4s ease-out 0.1s both;
                }

                /* Modal Actions */
                .modal-actions {
                    text-align: right;
                    animation: fadeInUp 0.4s ease-out 0.2s both;
                    padding: ${SPACING?.MD || '1rem'} ${SPACING?.XL || '2rem'};
                    border-top: 1px solid var(--border-color);
                    background-color: var(--color-bg-secondary);
                }

                /* Modal Type Styles */
                .modal-success .modal-header {
                    border-bottom-color: var(--color-success);
                }

                .modal-success .modal-header h2 {
                    color: var(--color-success);
                }

                .modal-error .modal-header {
                    border-bottom-color: var(--color-danger);
                }

                .modal-error .modal-header h2 {
                    color: var(--color-danger);
                }

                .modal-info .modal-header {
                    border-bottom-color: var(--color-info);
                }

                .modal-info .modal-header h2 {
                    color: var(--color-info);
                }

                .modal-summary .modal-header {
                    border-bottom-color: var(--color-primary);
                }

                .modal-summary .modal-header h2 {
                    color: var(--color-primary);
                }

                /* Summary Modal Specific Overrides */
                .modal-summary .modal-container {
                    width: 500px; /* Same width as other modals */
                }

                .modal-summary .modal-content {
                    padding: ${SPACING?.XL || '2rem'};
                }

                /* Summary Modal Specific Styles */
                .summary-content {
                    max-height: 50vh;
                    overflow-y: auto;
                }

                .summary-section {
                    margin-bottom: 1.5rem;
                }

                .summary-section:last-child {
                    margin-bottom: 0;
                }

                .summary-title {
                    color: var(--color-text-primary);
                    font-size: 1.125rem;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                }

                .summary-subtitle {
                    color: var(--color-text-secondary);
                    font-size: 1rem;
                    margin-bottom: 0.75rem;
                    display: flex;
                    align-items: center;
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                }

                .summary-item {
                    display: flex;
                    flex-direction: column;
                }

                .summary-label {
                    font-size: 0.875rem;
                    color: var(--color-text-muted);
                    margin-bottom: 0.25rem;
                }

                .summary-value {
                    font-size: 0.9375rem;
                    color: var(--color-text-primary);
                    font-weight: 500;
                }

                .format-badge {
                    display: inline-block;
                    background-color: var(--color-info);
                    color: white;
                    font-size: 0.75rem;
                    padding: 0.125rem 0.5rem;
                    border-radius: 12px;
                    margin-right: 0.25rem;
                    margin-bottom: 0.25rem;
                }

                .summary-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .summary-list-item {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid var(--border-color);
                }

                .summary-list-item:last-child {
                    border-bottom: none;
                }

                /* Animations */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
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

                /* Responsive Styles */
                @media (max-width: 768px) {
                    .modal-container {
                        width: 95vw;
                        max-width: 95vw;
                    }

                    .modal-header {
                        padding: ${SPACING?.MD || '1rem'};
                    }

                    .modal-header h2 {
                        font-size: 1.25rem;
                    }

                    .modal-content {
                        padding: ${SPACING?.LG || '1.5rem'};
                    }

                    .modal-close {
                        top: 12px;
                        right: 12px;
                        width: 32px;
                        height: 32px;
                    }

                    .summary-content {
                        max-height: 60vh;
                    }

                    .modal-actions {
                        padding: ${SPACING?.MD || '1rem'};
                    }
                }

                @media (max-width: 480px) {
                    .modal-container {
                        width: 98vw;
                        max-width: 98vw;
                    }

                    .modal-header {
                        padding: ${SPACING?.SM || '0.75rem'};
                    }

                    .modal-header h2 {
                        font-size: 1.1rem;
                    }

                    .modal-content {
                        padding: ${SPACING?.MD || '1rem'};
                    }

                    .modal-body {
                        margin-bottom: ${SPACING?.LG || '1.5rem'};
                        font-size: 0.95rem;
                    }

                    .modal-close {
                        font-size: 1rem;
                        top: 8px;
                        right: 8px;
                    }

                    .summary-grid {
                        grid-template-columns: 1fr;
                    }

                    .modal-actions {
                        padding: ${SPACING?.SM || '0.75rem'};
                    }
                }

                @media (max-height: 600px) {
                    .modal-overlay {
                        align-items: flex-start;
                        padding-top: ${SPACING?.LG || '1.5rem'};
                    }

                    .modal-container {
                        max-height: calc(100vh - 40px);
                    }

                    .modal-content {
                        max-height: calc(80vh - 120px);
                    }

                    .summary-content {
                        max-height: calc(50vh - 40px);
                    }
                }
            `}</style>

            <div
                className={`modal-overlay ${isOpen ? 'active' : ''}`}
                onClick={handleOverlayClick}
                onMouseDown={handleInteraction}
            >
                <div
                    className={`modal-container modal-${type}`}
                    onClick={handleModalClick}
                >
                    <div className="modal-header">
                        <h2 className="modal-title">{title}</h2>
                        <button
                            className="modal-close"
                            onClick={() => {
                                handleInteraction();
                                onClose();
                            }}
                            onMouseDown={handleInteraction}
                            aria-label="Close modal"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <div className="modal-content">
                        <div className="modal-body">
                            {children}
                        </div>
                    </div>

                    {actions && (
                        <div className="modal-actions">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default ModalElement;
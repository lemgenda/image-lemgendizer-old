import { useEffect } from 'react';
import {
    MODAL_TYPES
} from '../constants';
import '../styles/ModalElement.css';

function ModalElement({
    isOpen,
    onClose,
    title,
    children,
    type = MODAL_TYPES.INFO,
    onInteraction,
    actions
}) {
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape' && isOpen) {
                if (onInteraction) onInteraction();
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose, onInteraction]);

    const handleInteraction = () => {
        if (onInteraction) {
            onInteraction();
        }
    };

    const handleModalClick = (e) => {
        e.stopPropagation();
        handleInteraction();
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleInteraction();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className={`modal-overlay ${isOpen ? 'active' : ''}`}
            onClick={handleOverlayClick}
            onMouseDown={handleInteraction}
            role="button"
            tabIndex="-1"
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    handleOverlayClick(e);
                }
            }}
        >
            <div
                className={`modal-container modal-${type}`}
                onClick={handleModalClick}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
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
    );
}

export default ModalElement;
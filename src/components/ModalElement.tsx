import { useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MODAL_TYPES } from '../constants';
import '../styles/ModalElement.css';

interface ModalElementProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    type?: string;
    onInteraction?: () => void;
    actions?: ReactNode;
}

function ModalElement({
    isOpen,
    onClose,
    title,
    children,
    type = MODAL_TYPES.INFO,
    onInteraction,
    actions
}: ModalElementProps) {
    const { t } = useTranslation();
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
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

    const handleModalClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleInteraction();
    };

    const handleOverlayClick = (e: React.MouseEvent | React.KeyboardEvent) => {
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
            tabIndex={-1}
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
                        aria-label={t('button.close')}
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

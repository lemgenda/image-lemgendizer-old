import React from 'react';
import { useTranslation } from 'react-i18next';
import ModalElement from './ModalElement';
import { MODAL_TYPES } from '../constants';
import { ImageFile } from '../types';

interface EnhanceSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    processedImages: ImageFile[];
}

const EnhanceSummaryModal: React.FC<EnhanceSummaryModalProps> = ({ isOpen, onClose, processedImages }) => {
    const { t } = useTranslation();

    const enhancedImages = processedImages.filter(img => img.enhanceMetadata);

    if (enhancedImages.length === 0) return null;

    return (
        <ModalElement
            isOpen={isOpen}
            onClose={onClose}
            title={t('enhance.summary_title', 'Enhancement Summary')}
            type={MODAL_TYPES.SUCCESS}
        >
            <div className="enhance-summary-content">
                <p style={{ marginBottom: '15px' }}>{t('enhance.summary_desc', 'The following images were optimized using LemGendary AI:')}</p>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {enhancedImages.map((img, idx) => (
                            <li key={idx} style={{
                                padding: '10px',
                                borderBottom: idx === enhancedImages.length - 1 ? 'none' : '1px solid #eee',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</span>
                                    <span style={{
                                        backgroundColor: '#e7f3ff',
                                        color: '#007bff',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}>
                                        {t('enhance.quality', 'Quality')}: {img.enhanceMetadata?.nimaScore.toFixed(2)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {img.enhanceMetadata?.opsApplied.map((op, opIdx) => (
                                        <span key={opIdx} style={{
                                            backgroundColor: '#f0f0f0',
                                            color: '#666',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem'
                                        }}>
                                            {op}
                                        </span>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div style={{ marginTop: '15px', fontSize: '0.85rem', color: '#666', fontStyle: 'italic' }}>
                    {t('enhance.summary_footer', 'All enhancements were applied iteratively based on real-time quality analysis.')}
                </div>
            </div>
        </ModalElement>
    );
};

export default EnhanceSummaryModal;

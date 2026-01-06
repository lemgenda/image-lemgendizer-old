import React from 'react';
import { AIQualityOptions, ProcessingOptions } from '../types';
import '../styles/QualityImprovementCard.css';

interface QualityImprovementCardProps {
    options: AIQualityOptions;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    t: (key: string) => string;
}

/**
 * Component for selecting AI quality improvement options (denoise, deblur, etc.).
 *
 * @param {QualityImprovementCardProps} props - Component props
 * @param {AIQualityOptions} props.options - Current AI quality options
 * @param {Function} props.onOptionChange - Callback to update options
 */
export const QualityImprovementCard: React.FC<QualityImprovementCardProps> = ({ options, onOptionChange, t }) => {
    const handleToggle = (key: keyof AIQualityOptions) => {
        // [Antigravity] Allow multiple selections based on user request "select for each"
        onOptionChange('aiQuality', key, !options[key]);
    };

    const renderToggle = (key: keyof AIQualityOptions, label: string, icon: string) => (
        <div className="quality-toggle" key={key}>
            <button
                className={`btn btn-quality ${options[key] ? 'active' : ''}`}
                onClick={() => handleToggle(key)}
                aria-pressed={options[key]}
                title={label}
            >
                <i className={`fas ${icon}`}></i>
                <span>{label}</span>
            </button>
        </div>
    );

    return (
        <div className="card">
            <h3 className="card-title">
                <i className="fas fa-magic"></i> {t('aiQuality.title')}
            </h3>
            <div className="quality-grid">
                {renderToggle('deblur', t('aiQuality.deblur'), 'fa-image')}
                {renderToggle('dehazeIndoor', t('aiQuality.dehazeIndoor'), 'fa-home')}
                {renderToggle('dehazeOutdoor', t('aiQuality.dehazeOutdoor'), 'fa-tree')}
                {renderToggle('denoise', t('aiQuality.denoise'), 'fa-volume-mute')}
                {renderToggle('derain', t('aiQuality.derain'), 'fa-cloud-rain')}
                {renderToggle('lowLight', t('aiQuality.lowLight'), 'fa-moon')}
                {renderToggle('retouch', t('aiQuality.retouch'), 'fa-user-edit')}
                {renderToggle('detailReconstruction', t('aiQuality.detailReconstruction'), 'fa-microchip')}
                {renderToggle('colorCorrection', t('aiQuality.colorCorrection'), 'fa-palette')}
            </div>
            <div className="info-box">
                <i className="fas fa-info-circle"></i> {t('aiQuality.info')}
            </div>
            <div className="info-box warning-box" style={{ marginTop: '10px', fontSize: '0.9em', color: '#e65100' }}>
                <i className="fas fa-exclamation-triangle"></i> Warning: Enabling multiple AI improvements may increase processing time and memory usage.
            </div>
        </div>
    );
};

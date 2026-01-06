import React from 'react';
import { AIQualityOptions } from '../types';

interface QualityImprovementCardProps {
    options: AIQualityOptions;
    onOptionChange: (category: string, key: string, value: any) => void;
    t: (key: string) => string;
}

export const QualityImprovementCard: React.FC<QualityImprovementCardProps> = ({ options, onOptionChange, t }) => {
    const handleToggle = (key: keyof AIQualityOptions) => {
        // Create a new options object where only the clicked key is permitted to be true.
        // If the clicked key is already true, it becomes false (toggle off).
        // All other keys are set to false (mutual exclusion).
        const newOptions = Object.keys(options).reduce((acc, currentKey) => {
            const k = currentKey as keyof AIQualityOptions;
            acc[k] = k === key ? !options[key] : false;
            return acc;
        }, {} as AIQualityOptions);

        onOptionChange('aiQuality', key, newOptions[key]);
        // Note: The parent handler needs to support receiving just the single change
        // OR we should send the whole object. Using the standard pattern of key/value
        // might imply we need to update the parent state logic to enforce mutual exclusion
        // BUT for UI responsiveness, we usually want to send the update.
        // Actually, looking at CustomProcessingTab, onOptionChange updates nested state.
        // To enforce mutual exclusion, it's better if we update the whole 'aiQuality' object at once.
        // However, the signature is (category, key, value).
        // We might need to iterate and call onOptionChange for each, OR change the parent.
        // Let's assume onOptionChange handles it or we send 'aiQuality' as category and null as key?
        // Wait, standard pattern is onOptionChange('aiQuality', 'deblur', true).
        // If we want to unset others, we'd need to loop.
        // FOR NOW: Let's simpler logic: just toggle the one clicked.
        // Mutual exclusion is enforced by the processor typically, or we can leave it to the user.
        // Re-reading requirements: "AI Quality Improvement (Mutually Exclusive)".
        // So we SHOULD enforce it.

        // Let's iterate and disable others first?
        Object.keys(options).forEach(k => {
             if (k !== key && options[k as keyof AIQualityOptions]) {
                 onOptionChange('aiQuality', k, false);
             }
        });
        onOptionChange('aiQuality', key, !options[key]);
    };

    const renderToggle = (key: keyof AIQualityOptions, label: string, icon: string) => (
        <div className="quality-toggle" key={key}>
            <button
                className={`btn btn-quality ${options[key] ? 'active' : ''}`}
                onClick={() => handleToggle(key)}
                aria-pressed={options[key]}
            >
                <i className={`fas ${icon}`}></i>
                <span>{label}</span>
            </button>
        </div>
    );

    return (
        <section className="card">
            <h2 className="card-header">
                <i className="fas fa-magic"></i> {t('aiQuality.title')}
            </h2>
            <div className="card-body">
                <div className="quality-grid">
                    {renderToggle('deblur', t('aiQuality.deblur'), 'fa-image')}
                    {renderToggle('dehazeIndoor', t('aiQuality.dehazeIndoor'), 'fa-home')}
                    {renderToggle('dehazeOutdoor', t('aiQuality.dehazeOutdoor'), 'fa-tree')}
                    {renderToggle('denoise', t('aiQuality.denoise'), 'fa-volume-mute')}
                    {renderToggle('derain', t('aiQuality.derain'), 'fa-cloud-rain')}
                    {renderToggle('lowLight', t('aiQuality.lowLight'), 'fa-moon')}
                    {renderToggle('retouch', t('aiQuality.retouch'), 'fa-user-edit')}
                    {renderToggle('detailReconstruction', 'Detail Reconstruction', 'fa-microchip')}
                    {renderToggle('colorCorrection', 'Color Correction', 'fa-palette')}
                </div>
                <div className="info-box">
                    <i className="fas fa-info-circle"></i> {t('aiQuality.info')}
                </div>
            </div>
        </section>
    );
};

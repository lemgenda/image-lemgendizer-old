import React from 'react';
import { useProcessingContext } from '../context/ProcessingContext';
import { type AIModelStatus } from '../utils/aiWorkerUtils';
import { useTranslation } from 'react-i18next';

interface AIModelIconProps {
    model: string;
    icon: string;
    label: string;
    status: AIModelStatus;
}

const AIModelIcon: React.FC<AIModelIconProps> = ({ icon, label, status }) => {
    let className = 'ai-model-icon';
    let iconClass = `fas ${icon}`;

    switch (status) {
        case 'loading':
            className += ' status-loading';
            iconClass += ' fa-spin';
            break;
        case 'warming':
            className += ' status-warming';
            iconClass += ' ai-pulse-glow';
            break;
        case 'ready':
            className += ' status-ready';
            break;
        case 'error':
            className += ' status-error';
            iconClass = 'fas fa-exclamation-triangle';
            break;
        default:
            className += ' status-none';
            break;
    }

    return (
        <div className={className} title={`${label}: ${status}`}>
            <i className={iconClass}></i>
        </div>
    );
};

const AIEnhancementsBar: React.FC = () => {
    const { aiModelStatus } = useProcessingContext();
    const { t } = useTranslation();

    const models = [
        { key: 'coco', icon: 'fa-search', label: t('ai.model.coco') || 'Detection' },
        { key: 'upscaler2x', icon: 'fa-expand-arrows-alt', label: t('ai.model.upscaler') || 'Upscaling' },
        { key: 'enhancement', icon: 'fa-magic', label: t('ai.model.enhancement') || 'Enhancement' },
        { key: 'deblurring', icon: 'fa-eraser', label: t('ai.model.deblurring') || 'Deblurring' },
        { key: 'denoising', icon: 'fa-bolt', label: t('ai.model.denoising') || 'Denoising' },
        { key: 'deraining', icon: 'fa-umbrella', label: t('ai.model.deraining') || 'Deraining' },
        { key: 'dehazing-indoor', icon: 'fa-smog', label: t('ai.model.dehazing') || 'Dehazing' },
        { key: 'retouching', icon: 'fa-sparkles', label: t('ai.model.retouching') || 'Retouching' },
    ];

    return (
        <div className="ai-enhancements-bar">
            {models.map(m => (
                <AIModelIcon
                    key={m.key}
                    model={m.key}
                    icon={m.icon}
                    label={m.label}
                    status={aiModelStatus[m.key] || 'none'}
                />
            ))}
        </div>
    );
};

export default AIEnhancementsBar;

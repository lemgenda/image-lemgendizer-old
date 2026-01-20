import React from 'react';
import { useProcessingContext } from '../context/ProcessingContext';
import { type AIModelStatus } from '../utils/aiWorkerUtils';
import { useTranslation } from 'react-i18next';
import '../styles/AIEnhancementsBar.css';

interface AIModelIconProps {
    model: string;
    icon: string | React.ReactNode;
    label: string;
    status: AIModelStatus;
}

const AIModelIcon: React.FC<AIModelIconProps> = ({ model, icon, label, status }) => {
    // Map status to CSS state class
    const stateClass = status === 'none' ? 'ai-state-idle' : `ai-state-${status}`;

    // Determine model type for color coding
    let modelType = 'model-maxim';
    if (model.includes('coco') || model.includes('face') || model.includes('body')) modelType = 'model-coco';
    if (model.includes('upscaler')) modelType = 'model-upscaler';

    const renderIcon = () => {
        if (typeof icon !== 'string') {
            return (
                <div className={`ai-custom-icon ${status === 'loading' ? 'fa-spin' : ''} ${status === 'warming' ? 'ai-pulse' : ''}`}>
                    {icon}
                </div>
            );
        }

        let iconClass = `fas ${icon}`;
        if (status === 'loading') iconClass += ' fa-spin';
        if (status === 'warming') iconClass += ' ai-pulse';
        if (status === 'error') iconClass = 'fas fa-exclamation-triangle';

        return <i className={iconClass}></i>;
    };

    return (
        <div className={`ai-item ${modelType} ${stateClass}`}>
            <div className="ai-icon-wrapper">
                {renderIcon()}
            </div>
            <span className="ai-status-tooltip">{label}: {status}</span>
        </div>
    );
};

interface AIEnhancementsBarProps {
    onlyActive?: boolean;
}

interface UpscalerIconProps {
    factor: number;
    color: string;
}

const UpscalerIcon = ({ factor, color }: UpscalerIconProps) => (
    <span className="fa-stack fa-xs" style={{ color: color }}>
        <i className="fa-solid fa-expand fa-stack-2x" style={{ fontSize: '2em' }}></i>
        <span className="fa-stack-1x" style={{ marginTop: '-0.1em' }}>
            <i className="fa-solid fa-x" style={{ marginLeft: '-0.7em', fontSize: '0.7em' }}></i>
            <i className={`fa-solid fa-${factor}`} style={{ marginLeft: '-0.7em', fontSize: '1em' }}></i>
        </span>
    </span>
);

const AIEnhancementsBar: React.FC<AIEnhancementsBarProps> = ({ onlyActive = false }) => {
    const { aiModelStatus } = useProcessingContext();
    const { t } = useTranslation();

    const models = React.useMemo(() => [
        { key: 'coco', icon: 'fa-search', label: t('ai.model.coco') || 'Detection' },
        { key: 'body', icon: 'fa-user', label: t('ai.model.body') || 'Segmentation' },
        { key: 'face', icon: 'fa-smile', label: t('ai.model.face') || 'Landmarks' },
        { key: 'upscaler2x', icon: <UpscalerIcon factor={2} color="#06B184" />, label: t('ai.model.upscaler2x') || 'Upscaling 2x' },
        { key: 'upscaler3x', icon: <UpscalerIcon factor={3} color="lightgrey" />, label: t('ai.model.upscaler3x') || 'Upscaling 3x' },
        { key: 'upscaler4x', icon: <UpscalerIcon factor={4} color="lightgrey" />, label: t('ai.model.upscaler4x') || 'Upscaling 4x' },
        { key: 'enhancement', icon: 'fa-magic', label: t('ai.model.enhancement') || 'Enhancement' },
        { key: 'deblurring', icon: 'fa-eraser', label: t('ai.model.deblurring') || 'Deblurring' },
        { key: 'denoising', icon: 'fa-bolt', label: t('ai.model.denoising') || 'Denoising' },
        { key: 'deraining', icon: 'fa-umbrella', label: t('ai.model.deraining') || 'Deraining' },
        { key: 'dehazing-indoor', icon: 'fa-smog', label: t('ai.model.dehazingIndoor') || 'Dehazing (Indoor)' },
        { key: 'dehazing-outdoor', icon: 'fa-cloud-sun', label: t('ai.model.dehazingOutdoor') || 'Dehazing (Outdoor)' },
        { key: 'retouching', icon: 'fa-user-edit', label: t('ai.model.retouching') || 'Retouching' },
    ], [t]);

    const displayedModels = React.useMemo(() => (
        onlyActive
            ? models.filter(m => {
                const status = aiModelStatus[m.key] || 'none';
                return status !== 'none';
            })
            : models
    ), [onlyActive, models, aiModelStatus]);

    if (onlyActive && displayedModels.length === 0) return null;

    return (
        <div className="ai-enhancements-bar">
            {displayedModels.map(m => (
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

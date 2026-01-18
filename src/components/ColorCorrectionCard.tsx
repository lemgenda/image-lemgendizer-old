/**
 * @file ColorCorrectionCard.tsx
 * @description UI component for fine-tuning image properties like brightness, contrast, and saturation.
 */
import { useTranslation } from 'react-i18next';
import { useProcessingContext } from '../context/ProcessingContext';
import RangeSliderElement from './RangeSliderElement';
import '../styles/ColorCorrectionCard.css';

/**
 * ColorCorrectionCard component.
 * @component
 * @returns {JSX.Element} The rendered color correction card.
 */
const ColorCorrectionCard = () => {
    const { t } = useTranslation();
    const { processingOptions, handleColorCorrectionChange, toggleColorCorrection } = useProcessingContext();
    const options = processingOptions.colorCorrection || {
        enabled: false,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        vibrance: 0,
        exposure: 0,
        hue: 0,
        sepia: 0,
        gamma: 1.0,
        noise: 0,
        clip: 0,
        sharpen: 0,
        stackBlur: 0
    };

    const adjustments = [
        { key: 'brightness', icon: 'fa-sun', min: -100, max: 100, step: 1 },
        { key: 'contrast', icon: 'fa-adjust', min: -100, max: 100, step: 1 },
        { key: 'saturation', icon: 'fa-tint', min: -100, max: 100, step: 1 },
        { key: 'vibrance', icon: 'fa-waveform-path', min: -100, max: 100, step: 1 },
        { key: 'exposure', icon: 'fa-camera', min: -100, max: 100, step: 1 },
        { key: 'hue', icon: 'fa-fill-drip', min: 0, max: 100, step: 1 },
        { key: 'sepia', icon: 'fa-history', min: 0, max: 100, step: 1 },
        { key: 'gamma', icon: 'fa-chart-line', min: 0, max: 10, step: 0.1 },
        { key: 'noise', icon: 'fa-braille', min: 0, max: 100, step: 1 },
        { key: 'clip', icon: 'fa-cut', min: 0, max: 100, step: 1 },
        { key: 'sharpen', icon: 'fa-magic', min: 0, max: 100, step: 1 },
        { key: 'stackBlur', icon: 'fa-blur', min: 0, max: 20, step: 1 }
    ];

    const handleReset = () => {
        adjustments.forEach(adj => {
            const defaultValue = adj.key === 'gamma' ? 1.0 : 0;
            handleColorCorrectionChange(adj.key, defaultValue);
        });
    };

    return (
        <div className="card color-correction-card">
            <h3 className="card-title">
                <i className="fas fa-sliders-h"></i> {t('color.title')}
            </h3>

            <div className="toggle-btn mb-md px-sm">
                <button
                    type="button"
                    className={`btn w-full ${!options.enabled ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleColorCorrection(!options.enabled)}
                    title={options.enabled ? t('common.disable') : t('common.enable')}
                >
                    <i className={`fas fa-${options.enabled ? 'times-circle' : 'check-circle'} mr-2`}></i>
                    {options.enabled ? t('common.disable') : t('common.enable')}
                </button>
            </div>

            {options.enabled && (
                <div className="mt-md">
                    <div className="flex justify-end mb-sm px-sm">
                        <button
                            className="btn btn-outline btn-sm reset-btn"
                            onClick={handleReset}
                            title={t('color.reset_title')}
                        >
                            <i className="fas fa-undo"></i> {t('color.reset')}
                        </button>
                    </div>

                    <div className="adjustments-grid grid grid-cols-2 gap-sm px-sm">
                        {adjustments.map((adj) => (
                            <div key={adj.key} className="adjustment-item">
                                <RangeSliderElement
                                    label={t(`color.${adj.key}`)}
                                    icon={adj.icon}
                                    min={adj.min}
                                    max={adj.max}
                                    step={adj.step}
                                    value={(options as any)[adj.key]}
                                    onChange={(val: number) => handleColorCorrectionChange(adj.key, val)}
                                    disabled={!options.enabled}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorCorrectionCard;

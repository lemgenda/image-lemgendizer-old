import RangeSliderElement from './RangeSliderElement';
import { COMPRESSION_QUALITY_RANGE, NUMBER_INPUT_CONSTANTS } from '../constants';
import type { ProcessingOptions } from '../types';

/**
 * @file QualityControlsCard.tsx
 * @description UI component for adjusting compression quality and target file size settings.
 */

interface QualityControlsCardProps {
    quality: number;
    fileSize: string;
    onQualityChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    t: (key: string, params?: any) => string;
}

/**
 * QualityControlsCard component.
 * @component
 * @param {QualityControlsCardProps} props - Component props.
 * @returns {JSX.Element} The rendered quality controls card.
 */
const QualityControlsCard = ({
    quality,
    fileSize,
    onQualityChange,
    t
}: QualityControlsCardProps) => {
    return (
        <div className="card">
            <h3 className="card-title">
                <i className="fas fa-compress-alt"></i> {t('compression.title')}
            </h3>

            <div className="form-group">
                <RangeSliderElement
                    label={t('compression.quality')}
                    id="compression-quality-slider"
                    value={quality}
                    onChange={(value) => onQualityChange('compression', 'quality', value)}
                    min={COMPRESSION_QUALITY_RANGE.MIN}
                    max={COMPRESSION_QUALITY_RANGE.MAX}
                    step={1}
                />
            </div>

            <div className="form-group">
                <label className="form-label" htmlFor="target-file-size">{t('compression.targetSize')}</label>
                <div className="number-input-wrapper">
                    <input
                        type="number"
                        id="target-file-size"
                        className="input-field"
                        value={fileSize}
                        onChange={(e) => onQualityChange('compression', 'fileSize', e.target.value)}
                        placeholder={t('compression.auto')}
                        min={NUMBER_INPUT_CONSTANTS.MIN_VALUE}
                    />
                    <div className="number-input-spinner">
                        <button
                            type="button"
                            className="number-input-button"
                            onClick={() => onQualityChange('compression', 'fileSize', String(parseInt(fileSize || '0') + NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT))}
                        >
                            <i className="fas fa-chevron-up"></i>
                        </button>
                        <button
                            type="button"
                            className="number-input-button"
                            onClick={() => onQualityChange('compression', 'fileSize', String(Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, parseInt(fileSize || '10') - NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT)))}
                        >
                            <i className="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QualityControlsCard;

import {
    CROP_MODES,
    CROP_POSITION_LIST,
    RESIZE_DIMENSION_RANGE,
    CROP_DIMENSION_RANGE,
    NUMBER_INPUT_CONSTANTS
} from '../constants';
import type { ProcessingOptions } from '../types';
import '../styles/ResizeCropCard.css';

/**
 * @file ResizeCropCard.tsx
 * @description UI component for image resizing and cropping settings, including smart crop.
 */

interface ResizeCropCardProps {
    cropWidth: string;
    cropHeight: string;
    resizeDimension: string;
    showResize: boolean;
    cropMode: string;
    cropPosition: string;
    aiLoading: boolean;
    onToggleResizeCrop: (type: 'resize' | 'crop') => void;
    onToggleCropMode: (mode: string) => void;
    onOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    t: (key: string, params?: any) => string;
}

/**
 * ResizeCropCard component.
 * @component
 * @param {ResizeCropCardProps} props - Component props.
 * @returns {JSX.Element} The rendered resize and crop card.
 */
const ResizeCropCard = ({
    cropWidth,
    cropHeight,
    resizeDimension,
    showResize,
    cropMode,
    cropPosition,
    aiLoading,
    onToggleResizeCrop,
    onToggleCropMode,
    onOptionChange,
    t
}: ResizeCropCardProps) => {
    const handleIncrement = (field: keyof ProcessingOptions, increment: number = NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT) => {
        const currentValue = field === 'resizeDimension' ? resizeDimension :
            field === 'cropWidth' ? cropWidth : cropHeight;
        const newValue = String(parseInt(currentValue || '0') + increment);
        onOptionChange(field, newValue);
    };

    const handleDecrement = (field: keyof ProcessingOptions, increment: number = NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT) => {
        const currentValue = field === 'resizeDimension' ? resizeDimension :
            field === 'cropWidth' ? cropWidth : cropHeight;
        const minValue = field === 'resizeDimension' ? RESIZE_DIMENSION_RANGE.MIN : CROP_DIMENSION_RANGE.MIN;
        const newValue = String(Math.max(minValue, parseInt(currentValue || '10') - increment));
        onOptionChange(field, newValue);
    };

    return (
        <div className="card">
            <h3 className="card-title">
                {showResize ? (
                    <>
                        <i className="fas fa-expand-alt"></i> {t('resize.title')}
                    </>
                ) : (
                    <>
                        <i className="fas fa-crop-alt"></i> {cropMode === CROP_MODES.SMART ? t('crop.switchToSmart') : t('crop.switchToStandard')}
                    </>
                )}
            </h3>

            <div className="mb-md">
                <button
                    className="btn btn-secondary btn-full-width"
                    onClick={() => onToggleResizeCrop(showResize ? 'crop' : 'resize')}
                >
                    {showResize ? (
                        <>
                            <i className="fas fa-crop"></i> {t('resize.switchToCrop')}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-expand-alt"></i> {t('resize.switchToResize')}
                        </>
                    )}
                </button>
            </div>

            {showResize ? (
                <div className="form-group">
                    <label className="form-label" htmlFor="resize-dimension-input">{t('resize.dimension')}</label>
                    <div className="number-input-wrapper">
                        <input
                            type="number"
                            id="resize-dimension-input"
                            className="input-field"
                            value={resizeDimension}
                            onChange={(e) => onOptionChange('resizeDimension', e.target.value)}
                            placeholder={`e.g., ${RESIZE_DIMENSION_RANGE.DEFAULT}`}
                            min={RESIZE_DIMENSION_RANGE.MIN}
                            max={RESIZE_DIMENSION_RANGE.MAX}
                        />
                        <div className="number-input-spinner">
                            <button
                                type="button"
                                className="number-input-button"
                                onClick={() => handleIncrement('resizeDimension')}
                            >
                                <i className="fas fa-chevron-up"></i>
                            </button>
                            <button
                                type="button"
                                className="number-input-button"
                                onClick={() => handleDecrement('resizeDimension')}
                            >
                                <i className="fas fa-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                    <p className="form-helper">
                        {t('resize.helper')}
                    </p>
                </div>
            ) : (
                <div className="space-y-md">
                    <div className="form-group">
                        <div className="toggle-btn">
                            <button
                                type="button"
                                className={`btn ${cropMode === CROP_MODES.SMART ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => onToggleCropMode(cropMode === CROP_MODES.SMART ? CROP_MODES.STANDARD : CROP_MODES.SMART)}
                                disabled={aiLoading}
                            >
                                {cropMode === CROP_MODES.SMART ? (
                                    <>
                                        <i className="fas fa-crop-alt"></i> {t('crop.switchToStandard')}
                                        {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-brain"></i> {t('crop.switchToSmart')}
                                        {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                    </>
                                )}
                            </button>
                        </div>
                        {cropMode === CROP_MODES.SMART && (
                            <p className="text-sm text-muted mt-sm">
                                <i className="fas fa-info-circle mr-1"></i>
                                {t('crop.smartBest')}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-md">
                        <div className="form-group">
                            <label className="form-label" htmlFor="crop-width-input">{t('crop.width')}</label>
                            <div className="number-input-wrapper">
                                <input
                                    type="number"
                                    id="crop-width-input"
                                    className="input-field"
                                    value={cropWidth}
                                    onChange={(e) => onOptionChange('cropWidth', e.target.value)}
                                    placeholder="1080"
                                    min={CROP_DIMENSION_RANGE.MIN}
                                    max={CROP_DIMENSION_RANGE.MAX}
                                    disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                />
                                <div className="number-input-spinner">
                                    <button
                                        type="button"
                                        className="number-input-button"
                                        onClick={() => handleIncrement('cropWidth', NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT)}
                                        disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                    >
                                        <i className="fas fa-chevron-up"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="number-input-button"
                                        onClick={() => handleDecrement('cropWidth', NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT)}
                                        disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                    >
                                        <i className="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="crop-height-input">{t('crop.height')}</label>
                            <div className="number-input-wrapper">
                                <input
                                    type="number"
                                    id="crop-height-input"
                                    className="input-field"
                                    value={cropHeight}
                                    onChange={(e) => onOptionChange('cropHeight', e.target.value)}
                                    placeholder="1080"
                                    min={CROP_DIMENSION_RANGE.MIN}
                                    max={CROP_DIMENSION_RANGE.MAX}
                                    disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                />
                                <div className="number-input-spinner">
                                    <button
                                        type="button"
                                        className="number-input-button"
                                        onClick={() => handleIncrement('cropHeight', NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT)}
                                        disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                    >
                                        <i className="fas fa-chevron-up"></i>
                                    </button>
                                    <button
                                        type="button"
                                        className="number-input-button"
                                        onClick={() => handleDecrement('cropHeight', NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT)}
                                        disabled={aiLoading && cropMode === CROP_MODES.SMART}
                                    >
                                        <i className="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {cropMode === CROP_MODES.STANDARD && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="crop-position-select">{t('crop.position')}</label>
                            <select
                                id="crop-position-select"
                                value={cropPosition}
                                onChange={(e) => onOptionChange('cropPosition', e.target.value)}
                                className="select-field"
                            >
                                {CROP_POSITION_LIST.map(position => (
                                    <option key={position} value={position}>
                                        {t(`crop.position.${position}`)}
                                    </option>
                                ))}
                            </select>
                            <p className="form-helper">
                                {t('crop.helper')}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResizeCropCard;

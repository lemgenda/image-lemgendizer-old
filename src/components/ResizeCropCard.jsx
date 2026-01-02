import React from 'react';
import PropTypes from 'prop-types';
import '../styles/ResizeCropCard.css';
import {
    CROP_MODES,
    CROP_POSITION_LIST,
    RESIZE_DIMENSION_RANGE,
    CROP_DIMENSION_RANGE,
    NUMBER_INPUT_CONSTANTS
} from '../constants';

/**
 * @fileoverview Resize and crop card component for image dimension settings.
 * Handles both resize and crop modes with smart/standard crop options.
 */

/**
 * ResizeCropCard - Component for resize/crop settings
 * @param {Object} props - Component props
 * @param {boolean} props.showResize - Show resize or crop mode
 * @param {string} props.cropMode - Current crop mode (smart/standard)
 * @param {string} props.resizeDimension - Resize dimension value
 * @param {string} props.cropWidth - Crop width value
 * @param {string} props.cropHeight - Crop height value
 * @param {string} props.cropPosition - Crop position
 * @param {boolean} props.aiLoading - AI model loading status
 * @param {Function} props.onToggleResizeCrop - Toggle between resize/crop
 * @param {Function} props.onToggleCropMode - Toggle between smart/standard crop
 * @param {Function} props.onOptionChange - Handler for option changes
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Resize/crop card
 */
const ResizeCropCard = ({
    showResize,
    cropMode,
    resizeDimension,
    cropWidth,
    cropHeight,
    cropPosition,
    aiLoading,
    onToggleResizeCrop,
    onToggleCropMode,
    onOptionChange,
    t
}) => {
    const handleIncrement = (field, increment = NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT) => {
        const currentValue = field === 'resizeDimension' ? resizeDimension :
            field === 'cropWidth' ? cropWidth : cropHeight;
        const newValue = String(parseInt(currentValue || 0) + increment);
        onOptionChange(field, newValue);
    };

    const handleDecrement = (field, increment = NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT) => {
        const currentValue = field === 'resizeDimension' ? resizeDimension :
            field === 'cropWidth' ? cropWidth : cropHeight;
        const minValue = field === 'resizeDimension' ? RESIZE_DIMENSION_RANGE.MIN : CROP_DIMENSION_RANGE.MIN;
        const newValue = String(Math.max(minValue, parseInt(currentValue || 10) - increment));
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
                    onClick={onToggleResizeCrop}
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
                    <label className="form-label">{t('resize.dimension')}</label>
                    <div className="number-input-wrapper">
                        <input
                            type="number"
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
                                onClick={onToggleCropMode}
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
                            <label className="form-label">{t('crop.width')}</label>
                            <div className="number-input-wrapper">
                                <input
                                    type="number"
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
                            <label className="form-label">{t('crop.height')}</label>
                            <div className="number-input-wrapper">
                                <input
                                    type="number"
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
                            <label className="form-label">{t('crop.position')}</label>
                            <select
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

ResizeCropCard.propTypes = {
    showResize: PropTypes.bool.isRequired,
    cropMode: PropTypes.string.isRequired,
    resizeDimension: PropTypes.string,
    cropWidth: PropTypes.string,
    cropHeight: PropTypes.string,
    cropPosition: PropTypes.string.isRequired,
    aiLoading: PropTypes.bool.isRequired,
    onToggleResizeCrop: PropTypes.func.isRequired,
    onToggleCropMode: PropTypes.func.isRequired,
    onOptionChange: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default ResizeCropCard;

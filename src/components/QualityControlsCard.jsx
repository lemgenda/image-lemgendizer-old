import React from 'react';
import PropTypes from 'prop-types';
import { RangeSliderElement } from './index';
import { COMPRESSION_QUALITY_RANGE, NUMBER_INPUT_CONSTANTS } from '../constants';

/**
 * @fileoverview Quality controls card component for compression settings.
 * Provides a slider for adjusting compression quality from 1-100 and optional target file size.
 */

/**
 * QualityControlsCard - Component for compression quality settings
 * @param {Object} props - Component props
 * @param {number} props.quality - Current quality value (1-100)
 * @param {string} props.fileSize - Target file size in KB
 * @param {Function} props.onQualityChange - Handler for quality changes
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Quality controls card
 */
const QualityControlsCard = ({
    quality,
    fileSize,
    onQualityChange,
    t
}) => {
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
                            onClick={() => onQualityChange('compression', 'fileSize', String(parseInt(fileSize || 0) + NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT))}
                        >
                            <i className="fas fa-chevron-up"></i>
                        </button>
                        <button
                            type="button"
                            className="number-input-button"
                            onClick={() => onQualityChange('compression', 'fileSize', String(Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, parseInt(fileSize || 10) - NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT)))}
                        >
                            <i className="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

QualityControlsCard.propTypes = {
    quality: PropTypes.number.isRequired,
    fileSize: PropTypes.string,
    onQualityChange: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default QualityControlsCard;

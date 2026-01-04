import React from 'react';
import PropTypes from 'prop-types';
import { IMAGE_FORMATS } from '../constants';

/**
 * @fileoverview Format selection card component for choosing output image formats.
 * Provides checkboxes for WebP, AVIF, JPEG, PNG, and Original formats,
 * along with Select All and Clear All functionality, plus rename option.
 */

/**
 * FormatSelectionCard - Component for selecting output image formats
 * @param {Object} props - Component props
 * @param {Array<string>} props.selectedFormats - Currently selected formats
 * @param {boolean} props.rename - Whether rename is enabled
 * @param {string} props.newFileName - New file name if rename is enabled
 * @param {Function} props.onFormatToggle - Handler for toggling individual format
 * @param {Function} props.onSelectAll - Handler for selecting all formats
 * @param {Function} props.onClearAll - Handler for clearing all formats
 * @param {Function} props.onOptionChange - Handler for option changes (rename, fileName)
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Format selection card
 */
const FormatSelectionCard = ({
    selectedFormats,
    rename,
    newFileName,
    onFormatToggle,
    onSelectAll,
    onClearAll,
    onOptionChange,
    t
}) => {
    return (
        <div className="card">
            <h3 className="card-title">
                <i className="fas fa-file-image"></i> {t('output.title')}
            </h3>

            <div className="form-group">
                <label className="form-label">{t('output.format')}</label>
                <div className="space-y-sm mb-md">
                    <div className="grid grid-cols-2 gap-sm">
                        <label className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={selectedFormats.includes(IMAGE_FORMATS.WEBP)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.WEBP)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">
                                {t('output.format.webp')}
                            </span>
                        </label>

                        <label className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={selectedFormats.includes(IMAGE_FORMATS.AVIF)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.AVIF)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">
                                {t('output.format.avif')}
                            </span>
                        </label>

                        <label className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={selectedFormats.includes(IMAGE_FORMATS.JPG)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.JPG)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">{t('output.format.jpg')}</span>
                        </label>

                        <label className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={selectedFormats.includes(IMAGE_FORMATS.PNG)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.PNG)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">{t('output.format.png')}</span>
                        </label>

                        <label className="checkbox-wrapper">
                            <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={selectedFormats.includes(IMAGE_FORMATS.ORIGINAL)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.ORIGINAL)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">{t('output.format.original')}</span>
                        </label>
                    </div>

                    <div className="flex flex-col gap-xs mt-sm">
                        <button
                            className="btn btn-secondary btn-xs"
                            onClick={onSelectAll}
                        >
                            <i className="fas fa-check-square"></i> {t('output.selectAll')}
                        </button>
                        <button
                            className="btn btn-secondary btn-xs"
                            onClick={onClearAll}
                        >
                            <i className="fas fa-times-circle"></i> {t('output.clearAll')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="form-group">
                <label className="checkbox-wrapper">
                    <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={rename}
                        onChange={(e) => onOptionChange('output', 'rename', e.target.checked)}
                    />
                    <span className="checkbox-custom"></span>
                    <span>{t('output.rename')}</span>
                </label>
            </div>

            {rename && (
                <div className="form-group">
                    <label htmlFor="newFileName" className="form-label">{t('output.newFileName')}</label>
                    <input
                        type="text"
                        id="newFileName"
                        className="input-field"
                        value={newFileName}
                        onChange={(e) => onOptionChange('output', 'newFileName', e.target.value)}
                        placeholder={t('output.newFileName.placeholder')}
                    />
                </div>
            )}
        </div>
    );
};

FormatSelectionCard.propTypes = {
    selectedFormats: PropTypes.arrayOf(PropTypes.string).isRequired,
    rename: PropTypes.bool.isRequired,
    newFileName: PropTypes.string,
    onFormatToggle: PropTypes.func.isRequired,
    onSelectAll: PropTypes.func.isRequired,
    onClearAll: PropTypes.func.isRequired,
    onOptionChange: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default FormatSelectionCard;

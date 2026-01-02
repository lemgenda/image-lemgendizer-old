import React from 'react';
import PropTypes from 'prop-types';
import { QualityControlsCard, ResizeCropCard, FormatSelectionCard } from './index';
import { PROCESSING_MODES, CROP_MODES } from '../constants';

/**
 * @fileoverview Custom processing tab container.
 * Groups quality, resize, and crop controls with the main action button for custom mode.
 */

/**
 * CustomProcessingTab - Component for custom processing mode
 * @param {Object} props - Component props
 * @param {Object} props.processingOptions - Current processing options
 * @param {boolean} props.isLoading - Loading state
 * @param {boolean} props.aiLoading - AI model loading state
 * @param {Array} props.selectedImagesForProcessing - List of images to process
 * @param {Function} props.onOptionChange - Handler for state changes (nested)
 * @param {Function} props.onSingleOptionChange - Handler for state changes (flat)
 * @param {Function} props.onToggleResizeCrop - Handler for resize/crop toggle
 * @param {Function} props.onToggleCropMode - Handler for crop mode toggle (standard/smart)
 * @param {Function} props.onProcess - Handler for starting processing
 * @param {Function} props.t - Translation function
 * @returns {JSX.Element} Custom processing tab
 */
const CustomProcessingTab = ({
    processingOptions,
    isLoading,
    aiLoading,
    selectedImagesForProcessing,
    onOptionChange,
    onSingleOptionChange,
    onFormatToggle,
    onSelectAllFormats,
    onClearAllFormats,
    onToggleResizeCrop,
    onToggleCropMode,
    onProcess,
    t
}) => {
    const isProcessDisabled =
        selectedImagesForProcessing.length === 0 ||
        isLoading ||
        (processingOptions.cropMode === CROP_MODES.SMART && aiLoading) ||
        !processingOptions.output.formats ||
        processingOptions.output.formats.length === 0;

    return (
        <>
            <div className="grid grid-cols-auto gap-lg mb-lg">
                <QualityControlsCard
                    quality={processingOptions.compression.quality}
                    fileSize={processingOptions.compression.fileSize}
                    onQualityChange={onOptionChange}
                    t={t}
                />

                <FormatSelectionCard
                    selectedFormats={processingOptions.output.formats}
                    rename={processingOptions.output.rename}
                    newFileName={processingOptions.output.newFileName}
                    onFormatToggle={onFormatToggle}
                    onSelectAll={onSelectAllFormats}
                    onClearAll={onClearAllFormats}
                    onOptionChange={onOptionChange}
                    t={t}
                />

                <ResizeCropCard
                    showResize={processingOptions.showResize}
                    cropMode={processingOptions.cropMode}
                    resizeDimension={processingOptions.resizeDimension}
                    cropWidth={processingOptions.cropWidth}
                    cropHeight={processingOptions.cropHeight}
                    cropPosition={processingOptions.cropPosition}
                    aiLoading={aiLoading}
                    onToggleResizeCrop={onToggleResizeCrop}
                    onToggleCropMode={onToggleCropMode}
                    onOptionChange={onSingleOptionChange}
                    t={t}
                />
            </div>

            <div className="text-center">
                <button
                    className="btn btn-primary btn-lg"
                    disabled={isProcessDisabled}
                    onClick={onProcess}
                >
                    {isLoading ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> {t('button.processing')}
                        </>
                    ) : processingOptions.cropMode === CROP_MODES.SMART && aiLoading ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> {t('button.loadingAI')}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-download"></i> {t('button.process')}
                            <span className="ml-1">
                                ({t('button.imageCount', { count: selectedImagesForProcessing.length })} × {t('button.formatCount', { count: processingOptions.output.formats.length })})
                            </span>
                        </>
                    )}
                </button>
            </div>
        </>
    );
};

CustomProcessingTab.propTypes = {
    processingOptions: PropTypes.object.isRequired,
    isLoading: PropTypes.bool.isRequired,
    aiLoading: PropTypes.bool.isRequired,
    selectedImagesForProcessing: PropTypes.array.isRequired,
    onOptionChange: PropTypes.func.isRequired,
    onSingleOptionChange: PropTypes.func.isRequired,
    onFormatToggle: PropTypes.func.isRequired,
    onSelectAllFormats: PropTypes.func.isRequired,
    onClearAllFormats: PropTypes.func.isRequired,
    onToggleResizeCrop: PropTypes.func.isRequired,
    onToggleCropMode: PropTypes.func.isRequired,
    onProcess: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

export default CustomProcessingTab;

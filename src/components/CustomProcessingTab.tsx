import { QualityControlsCard, ResizeCropCard, FormatSelectionCard, QualityImprovementCard } from './index';
import { CROP_MODES } from '../constants';
import type { ProcessingOptions, ImageFile } from '../types';

/**
 * @fileoverview Custom processing tab container.
 * Groups quality, resize, and crop controls with the main action button for custom mode.
 */

interface CustomProcessingTabProps {
    processingOptions: ProcessingOptions;
    isLoading: boolean;
    aiLoading: boolean;
    selectedImagesForProcessing: ImageFile[];
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    onFormatToggle: (format: string) => void;
    onSelectAllFormats: () => void;
    onClearAllFormats: () => void;
    onToggleResizeCrop: (type: 'resize' | 'crop') => void;
    onToggleCropMode: (mode: string) => void;
    onProcess: () => void;
    t: (key: string, params?: any) => string;
}

/**
 * CustomProcessingTab - Component for custom processing mode
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
}: CustomProcessingTabProps) => {
    const anyAIQualityEnabled = processingOptions.aiQuality && Object.values(processingOptions.aiQuality).some(v => v === true);
    const isProcessDisabled =
        selectedImagesForProcessing.length === 0 ||
        isLoading ||
        ((processingOptions.cropMode === CROP_MODES.SMART || anyAIQualityEnabled) && aiLoading) ||
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
                        cropWidth={processingOptions.cropWidth}
                        cropHeight={processingOptions.cropHeight}
                        resizeDimension={processingOptions.resizeDimension}
                        showResize={processingOptions.showResize}
                        cropMode={processingOptions.cropMode}
                        cropPosition={processingOptions.cropPosition}
                        aiLoading={aiLoading}
                        onToggleResizeCrop={onToggleResizeCrop}
                        onToggleCropMode={onToggleCropMode}
                        onOptionChange={(key, value) => onSingleOptionChange(key as keyof ProcessingOptions, value)}
                        t={t}
                    />

                <QualityImprovementCard
                    options={processingOptions.aiQuality || {
                        deblur: false,
                        dehazeIndoor: false,
                        dehazeOutdoor: false,
                        denoise: false,
                        derain: false,
                        lowLight: false,
                        retouch: false,
                        detailReconstruction: false,
                        colorCorrection: false
                    }}
                    onOptionChange={onOptionChange}
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
                    ) : (processingOptions.cropMode === CROP_MODES.SMART || anyAIQualityEnabled) && aiLoading ? (
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

export default CustomProcessingTab;

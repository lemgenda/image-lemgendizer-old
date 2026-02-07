import QualityControlsCard from './QualityControlsCard';
import ResizeCropCard from './ResizeCropCard';
import FormatSelectionCard from './FormatSelectionCard';
import FilterSelectionCard from './FilterSelectionCard';
import ColorCorrectionCard from './ColorCorrectionCard';
import WatermarkCard from './WatermarkCard';
import RestorationCard from './RestorationCard';
import { CROP_MODES, IMAGE_FILTERS } from '../constants';
import type { ProcessingOptions, ImageFile } from '../types';

/**
 * @file CustomProcessingTab.tsx
 * @description Container component for custom image processing controls (quality, resize, crop, filters).
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
 * CustomProcessingTab component.
 * @component
 * @param {CustomProcessingTabProps} props - Component props.
 * @returns {JSX.Element} The rendered custom processing tab.
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
                    cropWidth={processingOptions.cropWidth}
                    cropHeight={processingOptions.cropHeight}
                    resizeDimension={processingOptions.resizeDimension}
                    showResize={processingOptions.showResize}
                    cropMode={processingOptions.cropMode}
                    cropPosition={processingOptions.cropPosition}
                    aiLoading={aiLoading}
                    onToggleResizeCrop={onToggleResizeCrop}
                    onToggleCropMode={onToggleCropMode}
                    onOptionChange={(key: string, value: any) => onSingleOptionChange(key as keyof ProcessingOptions, value)}
                    t={t}
                />

                <RestorationCard
                    modelName={processingOptions.restoration?.modelName || ''}
                    enabled={!!processingOptions.restoration?.enabled}
                    onOptionChange={onOptionChange as (category: string, key: string, value: any) => void}
                    t={t}
                />

                <WatermarkCard
                    watermark={processingOptions.watermark}
                    onOptionChange={onOptionChange as (category: string, key: string, value: any) => void}
                />

                <div className="col-span-2">
                    <ColorCorrectionCard />
                </div>
            </div>

            <div className="mb-lg">
                <FilterSelectionCard
                    selectedFilter={processingOptions.filters?.selectedFilter || IMAGE_FILTERS.NONE}
                    onFilterChange={(filter: string) => onOptionChange('filters', 'selectedFilter', filter)}
                    t={t}
                    disabled={!!processingOptions.colorCorrection?.enabled}
                />
            </div>

            <div className="text-center mb-lg">
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

export default CustomProcessingTab;

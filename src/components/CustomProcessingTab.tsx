import QualityControlsCard from './QualityControlsCard';
import ResizeCropCard from './ResizeCropCard';
import FormatSelectionCard from './FormatSelectionCard';
import WatermarkCard from './WatermarkCard';
import type { ProcessingOptions } from '../types';

/**
 * @file CustomProcessingTab.tsx
 * @description Container component for custom image processing controls (quality, resize, crop).
 */

interface CustomProcessingTabProps {
    processingOptions: ProcessingOptions;
    aiLoading: boolean;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    onSingleOptionChange: (key: keyof ProcessingOptions, value: any) => void;
    onFormatToggle: (format: string) => void;
    onSelectAllFormats: () => void;
    onClearAllFormats: () => void;
    onToggleResizeCrop: (type: 'resize' | 'crop') => void;
    onToggleCropMode: (mode: string) => void;
    processCustomImages: () => Promise<void>;
    isLoading: boolean;
    selectedImagesCount: number;
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
    aiLoading,
    onOptionChange,
    onSingleOptionChange,
    onFormatToggle,
    onSelectAllFormats,
    onClearAllFormats,
    onToggleResizeCrop,
    onToggleCropMode,
    processCustomImages,
    isLoading,
    selectedImagesCount,
    t
}: CustomProcessingTabProps) => {
    return (
        <div className="flex flex-col mb-lg">
            <details className="settings-accordion" name="custom-options">
                <summary>
                    <div className="flex items-center gap-sm">
                        <i className="fas fa-expand-arrows-alt text-primary flex-shrink-0"></i>
                        <span>{t('resize.title')} & {t('crop.title')}</span>
                    </div>
                    <i className="fas fa-chevron-down text-sm"></i>
                </summary>
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
            </details>

            <details className="settings-accordion" name="custom-options">
                <summary>
                    <div className="flex items-center gap-sm">
                        <i className="fas fa-file-export text-primary flex-shrink-0"></i>
                        <span>{t('output.title') || 'Output Settings'}</span>
                    </div>
                    <i className="fas fa-chevron-down text-sm"></i>
                </summary>
                <FormatSelectionCard
                    selectedFormats={processingOptions.output.formats}
                    rename={processingOptions.output.rename}
                    newFileName={processingOptions.output.newFileName}
                    onFormatToggle={onFormatToggle}
                    onSelectAll={onSelectAllFormats}
                    onClearAll={onClearAllFormats}
                    onOptionChange={onOptionChange}
                    enhanceEnabled={processingOptions.enhance?.enabled || false}
                    t={t}
                />
            </details>

            <details className="settings-accordion" name="custom-options">
                <summary>
                    <div className="flex items-center gap-sm">
                        <i className="fas fa-water text-primary flex-shrink-0"></i>
                        <span>{t('watermark.title') || 'Watermark'}</span>
                    </div>
                    <i className="fas fa-chevron-down text-sm"></i>
                </summary>
                <WatermarkCard
                    watermark={processingOptions.watermark}
                    onOptionChange={onOptionChange as (category: string, key: string, value: any) => void}
                />
            </details>

            <details className="settings-accordion" name="custom-options">
                <summary>
                    <div className="flex items-center gap-sm">
                        <i className="fas fa-compress-alt text-primary flex-shrink-0"></i>
                        <span>{t('compression.title') || 'Compression'}</span>
                    </div>
                    <i className="fas fa-chevron-down text-sm"></i>
                </summary>
                <QualityControlsCard
                    quality={processingOptions.compression.quality}
                    fileSize={processingOptions.compression.fileSize}
                    onQualityChange={onOptionChange}
                    t={t}
                />
            </details>

            <div className="mt-lg" style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <button
                    className="btn btn-primary w-full"
                    onClick={processCustomImages}
                    disabled={isLoading || selectedImagesCount === 0}
                >
                    <i className="fas fa-cog"></i>
                    {isLoading ? t('button.processing') : `${t('button.process')} (${selectedImagesCount})`}
                </button>
            </div>
        </div>
    );

};

export default CustomProcessingTab;

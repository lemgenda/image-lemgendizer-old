import { IMAGE_FORMATS } from '../constants';
import type { ProcessingOptions } from '../types';

/**
 * @file FormatSelectionCard.tsx
 * @description UI component for choosing output image formats (WebP, AVIF, JPEG, PNG, Original).
 */

interface FormatSelectionCardProps {
    selectedFormats: string[];
    rename: boolean;
    newFileName: string;
    onFormatToggle: (format: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    t: (key: string, params?: any) => string;
}

/**
 * FormatSelectionCard component.
 * @component
 * @param {FormatSelectionCardProps} props - Component props.
 * @returns {JSX.Element} The rendered format selection card.
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
}: FormatSelectionCardProps) => {
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

export default FormatSelectionCard;

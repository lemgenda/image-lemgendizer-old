import { IMAGE_FORMATS } from '../constants';
import type { ProcessingOptions } from '../types';
import '../styles/FormatSelectionCard.css';

interface FormatSelectionCardProps {
    selectedFormats: string[];
    rename: boolean;
    newFileName: string;
    onFormatToggle: (format: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    enhanceEnabled: boolean;
    t: (key: string, params?: any) => string;
}

const FormatSelectionCard = ({
    selectedFormats,
    rename,
    newFileName,
    onFormatToggle,
    onSelectAll,
    onClearAll,
    onOptionChange,
    enhanceEnabled,
    t
}: FormatSelectionCardProps) => {
    return (
        <div className="card format-selection-card format-selection-card--compact h-full">
            <div className="card-header border-b border-border pb-2 mb-3">
                <h3 className="card-title mb-0 flex items-center">
                    <i className="fas fa-file-image text-primary"></i>
                    {t('output.title')}
                </h3>
            </div>

            <div className="card-body">
                <div className="form-group">
                    <label className="form-label">{t('output.format')}</label>
                    <div className="checkbox-group">
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
                                checked={selectedFormats.includes(IMAGE_FORMATS.JXL)}
                                onChange={() => onFormatToggle(IMAGE_FORMATS.JXL)}
                            />
                            <span className="checkbox-custom"></span>
                            <span className="checkbox-label">JXL</span>
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

                    <div className="format-actions">
                        <button
                            className="btn btn-secondary btn-xs"
                            onClick={onSelectAll}
                        >
                            {t('output.selectAll')}
                        </button>
                        <button
                            className="btn btn-secondary btn-xs"
                            onClick={onClearAll}
                        >
                            {t('output.clearAll')}
                        </button>
                    </div>
                </div>

                <div className="form-group border-t border-border pt-3 mt-3">
                    <label className="checkbox-wrapper">
                        <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={rename}
                            onChange={(e) => onOptionChange('output', 'rename', e.target.checked)}
                        />
                        <span className="checkbox-custom checkbox-primary"></span>
                        <span className="checkbox-label">{t('output.rename')}</span>
                    </label>
                    <p className="text-xs text-muted mt-1 ml-7">
                        {t('output.renameDesc')}
                    </p>
                </div>

                {rename && (
                    <div className="form-group">
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

                <div className="form-group border-t border-border pt-3 mt-3">
                    <label className="checkbox-wrapper">
                        <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={enhanceEnabled}
                            onChange={(e) => onOptionChange('enhance', 'enabled', e.target.checked)}
                        />
                        <span className="checkbox-custom checkbox-primary"></span>
                        <span className="checkbox-label">
                            {t('enhance.checkbox')}
                        </span>
                    </label>
                    <p className="text-xs text-muted mt-1 ml-7">
                        {t('enhance.description')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FormatSelectionCard;

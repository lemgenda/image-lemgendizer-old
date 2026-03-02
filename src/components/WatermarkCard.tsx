import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    WATERMARK_POSITIONS,
    WATERMARK_SIZES,
    DEFAULT_PROCESSING_CONFIG
} from '../constants';
import FontSelector from './FontSelector';
import ColorSelector from './ColorSelector';
import RangeSliderElement from './RangeSliderElement';
import { WatermarkOptions } from '../types';
import '../styles/WatermarkCard.css';

interface WatermarkCardProps {
    watermark?: WatermarkOptions;
    onOptionChange: (category: string, key: string, value: any) => void;
}

/**
 * WatermarkCard component for managing watermark settings.
 * Type selection (Text/Image) toggles watermark on/off — no separate enable button.
 */
function WatermarkCard({
    watermark,
    onOptionChange
}: WatermarkCardProps) {
    const { t } = useTranslation();

    const w: WatermarkOptions = {
        ...(DEFAULT_PROCESSING_CONFIG.watermark as WatermarkOptions),
        ...(watermark || {})
    };

    /** Toggle a watermark type on/off. Clicking the active type deselects it (disables watermark). */
    const handleTypeToggle = (type: 'text' | 'image') => {
        if (w.enabled && w.type === type) {
            // Deselect — disable watermark
            onOptionChange('watermark', 'enabled', false);
        } else {
            // Select this type — enable watermark
            onOptionChange('watermark', 'type', type);
            onOptionChange('watermark', 'enabled', true);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onOptionChange('watermark', 'image', reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const isTextSelected = w.enabled && w.type === 'text';
    const isImageSelected = w.enabled && w.type === 'image';
    const hasTypeSelected = isTextSelected || isImageSelected;

    return (
        <div className="watermark-card card h-full">
            <div className="card-header border-b border-border pb-2 mb-3">
                <h3 className="card-title mb-0 flex items-center">
                    <i className="fas fa-copyright text-primary"></i>
                    {t('watermark.title')}
                </h3>
            </div>

            <div className="card-body">
                {/* Hint text above buttons */}
                {!hasTypeSelected && (
                    <p className="text-xs text-muted">
                        {t('watermark.selectTypeHint')}
                    </p>
                )}

                {/* Type selection — same row like format buttons */}
                <div className="form-group">
                    <div className="watermark-type-actions">
                        <button
                            type="button"
                            className={`btn btn-xs ${isTextSelected ? 'watermark-type-btn--active' : 'btn-secondary'}`}
                            onClick={() => handleTypeToggle('text')}
                        >
                            {t('watermark.type.text')}
                        </button>
                        <button
                            type="button"
                            className={`btn btn-xs ${isImageSelected ? 'watermark-type-btn--active' : 'btn-secondary'}`}
                            onClick={() => handleTypeToggle('image')}
                        >
                            {t('watermark.type.image')}
                        </button>
                    </div>
                </div>

                {hasTypeSelected && (
                    <div className="watermark-options-grid space-y-sm">
                        {/* Preview notice */}
                        <p className="text-xs text-muted">
                            {t('watermark.previewNotice')}
                        </p>

                        {/* Text-specific options */}
                        {isTextSelected && (
                            <div className="space-y-sm" key="watermark-text-input-group">
                                <div className="form-group">
                                    <label className="form-label">{t('watermark.text')}</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={String(w.text || '')}
                                        onChange={(e) => onOptionChange('watermark', 'text', e.target.value)}
                                        placeholder={t('watermark.placeholder')}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-sm">
                                    <ColorSelector
                                        label={t('watermark.color')}
                                        value={String(w.color || '#ffffff')}
                                        onChange={(color: string) => onOptionChange('watermark', 'color', color)}
                                    />
                                    <div className="form-group">
                                        <label className="form-label">{t('watermark.fontSize')}</label>
                                        <div className="number-input-wrapper watermark-font-size-input">
                                            <input
                                                type="number"
                                                className="input-field"
                                                value={Number(w.fontSize) || 32}
                                                onChange={(e) => onOptionChange('watermark', 'fontSize', parseInt(e.target.value, 10))}
                                                min={8}
                                                max={200}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <FontSelector
                                    label={t('watermark.fontFamily')}
                                    value={w.fontFamily || 'Arial'}
                                    onChange={(font: string) => onOptionChange('watermark', 'fontFamily', font)}
                                />
                            </div>
                        )}

                        {/* Image-specific options */}
                        {isImageSelected && (
                            <div className="form-group" key="watermark-image-input-group">
                                <label className="form-label">{t('watermark.image')}</label>
                                <div className="flex gap-sm align-center">
                                    <input
                                        type="file"
                                        className="hidden"
                                        id="watermark-image-upload"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                    <label htmlFor="watermark-image-upload" className="btn btn-secondary btn-sm flex-1 cursor-pointer">
                                        <i className="fas fa-upload mr-1"></i> {t('watermark.upload')}
                                    </label>
                                    {w.image && (
                                        <button
                                            type="button"
                                            className="btn btn-danger btn-sm"
                                            onClick={() => onOptionChange('watermark', 'image', null)}
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Shared options */}
                        <div className="form-group">
                            <RangeSliderElement
                                label={t('watermark.opacity')}
                                min={10}
                                max={100}
                                step={10}
                                value={Math.round((w.opacity ?? 0.5) * 100)}
                                onChange={(val) => onOptionChange('watermark', 'opacity', val / 100)}
                                unit="%"
                                showTicks={true}
                            />
                        </div>

                        <div className="form-group">
                            <label className="checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    className="checkbox-input"
                                    checked={!!w.repeat}
                                    onChange={(e) => onOptionChange('watermark', 'repeat', e.target.checked)}
                                />
                                <span className="checkbox-custom"></span>
                                <span className="checkbox-label">{t('watermark.repeat')}</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-sm">
                            <div className="form-group">
                                <label className="form-label" htmlFor="watermark-size-select">{t('watermark.size')}</label>
                                <select
                                    id="watermark-size-select"
                                    className="select-field"
                                    value={w.size || 'medium'}
                                    onChange={(e) => onOptionChange('watermark', 'size', e.target.value)}
                                >
                                    {Object.values(WATERMARK_SIZES).map(size => (
                                        <option key={size} value={size}>
                                            {t(`watermark.size.${size.toLowerCase()}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={`form-group ${w.repeat ? 'opacity-50 pointer-events-none' : ''}`}>
                                <label className="form-label" htmlFor="watermark-position-select">{t('watermark.position')}</label>
                                <select
                                    id="watermark-position-select"
                                    className="select-field"
                                    value={w.position || 'bottom-right'}
                                    onChange={(e) => onOptionChange('watermark', 'position', e.target.value)}
                                    disabled={!!w.repeat}
                                >
                                    {Object.values(WATERMARK_POSITIONS).map(pos => (
                                        <option key={pos} value={pos}>
                                            {t(`watermark.position.${pos}`)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WatermarkCard;

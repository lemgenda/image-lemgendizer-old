import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    WATERMARK_POSITIONS,
    WATERMARK_SIZES,
    DEFAULT_PROCESSING_CONFIG
} from '../constants';
import FontSelector from './FontSelector';
import ColorSelector from './ColorSelector';
import FontSizeSelector from './FontSizeSelector';
import { WatermarkOptions } from '../types';
import '../styles/WatermarkCard.css';

interface WatermarkCardProps {
    watermark?: WatermarkOptions;
    onOptionChange: (category: string, key: string, value: any) => void;
}

/**
 * WatermarkCard component for managing watermark settings.
 * @component
 * @param {WatermarkCardProps} props - Component props.
 * @returns {JSX.Element} The rendered watermark card.
 */
function WatermarkCard({
    watermark,
    onOptionChange
}: WatermarkCardProps) {
    const { t } = useTranslation();

    // Ultimate Safety: ensures 'w' always has valid types even during state transitions
    const w: WatermarkOptions = {
        ...(DEFAULT_PROCESSING_CONFIG.watermark as WatermarkOptions),
        ...(watermark || {})
    };

    const handleToggle = () => onOptionChange('watermark', 'enabled', !w.enabled);

    const handleTypeChange = (type: 'text' | 'image') => onOptionChange('watermark', 'type', type);

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

    const handlePositionChange = (position: string) => onOptionChange('watermark', 'position', position);

    const handleSizeChange = (size: string) => onOptionChange('watermark', 'size', size);

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'opacity', parseFloat(e.target.value));
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'text', e.target.value);
    };

    const handleRepeatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'repeat', e.target.checked);
    };

    return (
        <div className="watermark-card card">
            <h3 className="card-title">
                <i className="fas fa-copyright"></i> {t('watermark.title')}
            </h3>

            <div className="toggle-btn mb-md px-sm">
                <button
                    type="button"
                    className={`btn w-full ${!w.enabled ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={handleToggle}
                    title={w.enabled ? t('watermark.disable') : t('watermark.enable')}
                >
                    <i className={`fas fa-${w.enabled ? 'times-circle' : 'check-circle'} mr-2`}></i>
                    {w.enabled ? t('common.disable') : t('common.enable')}
                </button>
            </div>

            {w.enabled && (
                <div className="space-y-md mt-md">
                    {/* Info Box */}
                    <div className="alert alert-info py-xs px-sm mb-md text-xs">
                        <i className="fas fa-info-circle mr-1"></i> {t('watermark.previewNotice')}
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('watermark.type')}</label>
                        <div className="btn-group btn-group-sm w-full">
                            <button
                                type="button"
                                className={`btn ${w.type === 'text' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => handleTypeChange('text')}
                            >
                                <i className="fas fa-font mr-1"></i> {t('watermark.type.text')}
                            </button>
                            <button
                                type="button"
                                className={`btn ${w.type === 'image' ? 'btn-primary' : 'btn-outline-primary'}`}
                                onClick={() => handleTypeChange('image')}
                            >
                                <i className="fas fa-image mr-1"></i> {t('watermark.type.image')}
                            </button>
                        </div>
                    </div>

                    {w.type === 'text' && (
                        <div className="space-y-sm" key="watermark-text-input-group">
                            <div className="form-group">
                                <label className="form-label">{t('watermark.text')}</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={String(w.text || '')}
                                    onChange={handleTextChange}
                                    placeholder={t('watermark.placeholder')}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-sm">
                                <ColorSelector
                                    label={t('watermark.color')}
                                    value={String(w.color || '#ffffff')}
                                    onChange={(color: string) => onOptionChange('watermark', 'color', color)}
                                />
                                <FontSizeSelector
                                    label={t('watermark.fontSize')}
                                    value={Number(w.fontSize) || 32}
                                    onChange={(size: number) => onOptionChange('watermark', 'fontSize', size)}
                                />
                            </div>
                            <FontSelector
                                label={t('watermark.fontFamily')}
                                value={w.fontFamily || 'Arial'}
                                onChange={(font: string) => onOptionChange('watermark', 'fontFamily', font)}
                            />
                        </div>
                    )}

                    {w.type === 'image' && (
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

                    <div className="form-group">
                        <div className="justify-between flex">
                            <label className="form-label">{t('watermark.opacity')}</label>
                            <span className="text-xs text-muted">{Math.round((w.opacity ?? 0.5) * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            className="form-control-range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={Number(w.opacity) || 0.5}
                            onChange={handleOpacityChange}
                        />
                    </div>

                    <div className="form-group">
                        <label className="checkbox-container text-sm">
                            <input
                                type="checkbox"
                                checked={!!w.repeat}
                                onChange={handleRepeatChange}
                            />
                            <span className="checkbox-checkmark"></span>
                            {t('watermark.repeat')}
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-sm mb-sm px-sm">
                        <div className="form-group">
                            <label className="form-label" htmlFor="watermark-size-select">{t('watermark.size')}</label>
                            <select
                                id="watermark-size-select"
                                className="select-field"
                                value={w.size || 'medium'}
                                onChange={(e) => handleSizeChange(e.target.value)}
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
                                onChange={(e) => handlePositionChange(e.target.value)}
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
    );
}

export default WatermarkCard;

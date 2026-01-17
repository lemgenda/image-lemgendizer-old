import React from 'react';
import { WATERMARK_POSITIONS, WATERMARK_SIZES, DEFAULT_PROCESSING_CONFIG } from '../constants';
import type { ProcessingOptions, WatermarkOptions } from '../types';

/**
 * @file WatermarkCard.tsx
 * @description UI component for configuring advanced watermark settings (text/image).
 */

interface WatermarkCardProps {
    watermark?: WatermarkOptions;
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    t: (key: string, params?: any) => string;
}

const WatermarkCard = ({
    watermark,
    onOptionChange,
    t
}: WatermarkCardProps) => {
    // Ultimate safety: Merge with defaults to ensure NO property is ever undefined
    const w = {
        ...DEFAULT_PROCESSING_CONFIG.watermark,
        ...(watermark || {})
    } as Required<WatermarkOptions>;

    const handleToggle = () => {
        onOptionChange('watermark', 'enabled', !w.enabled);
    };

    const handleTypeToggle = (type: 'text' | 'image') => {
        onOptionChange('watermark', 'type', type);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'text', e.target.value || '');
    };

    const handlePositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onOptionChange('watermark', 'position', e.target.value);
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        onOptionChange('watermark', 'opacity', (isNaN(val) ? 50 : val) / 100);
    };

    const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onOptionChange('watermark', 'size', e.target.value);
    };

    const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'fontSize', parseInt(e.target.value) || 24);
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('watermark', 'color', e.target.value || '#ffffff');
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                onOptionChange('watermark', 'image', event.target?.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleClearImage = () => {
        onOptionChange('watermark', 'image', null);
    };

    return (
        <div className="card">
            <h3 className="card-title">
                <i className="fas fa-copyright"></i> {t('watermark.title')}
            </h3>

            <div className="form-group mb-md">
                <div className="toggle-btn">
                    <button
                        type="button"
                        className={`btn ${w.enabled ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={handleToggle}
                    >
                        {w.enabled ? t('common.enabled') : t('common.disabled')}
                    </button>
                </div>
            </div>

            {w.enabled && (
                <div className="space-y-md">
                    {/* Watermark Type Selector */}
                    <div className="form-group">
                        <div className="flex gap-sm">
                            <button
                                className={`btn btn-sm flex-1 ${w.type === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleTypeToggle('text')}
                            >
                                <i className="fas fa-font mr-2"></i> {t('watermark.type.text')}
                            </button>
                            <button
                                className={`btn btn-sm flex-1 ${w.type === 'image' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleTypeToggle('image')}
                            >
                                <i className="fas fa-image mr-2"></i> {t('watermark.type.image')}
                            </button>
                        </div>
                    </div>

                    {/* Conditional Input based on Type */}
                    {w.type === 'text' ? (
                        <div className="form-group" key="watermark-text-input-group">
                            <label className="form-label" htmlFor="watermark-text">{t('watermark.text')}</label>
                            <input
                                type="text"
                                id="watermark-text"
                                className="input-field"
                                value={String(w.text || '')}
                                onChange={handleTextChange}
                                placeholder={t('watermark.placeholder')}
                            />
                        </div>
                    ) : (
                        <div className="form-group" key="watermark-image-input-group">
                            <label className="form-label">{t('watermark.image')}</label>
                            {w.image ? (
                                <div className="flex items-center gap-md">
                                    <div className="w-16 h-16 rounded border bg-gray-50 flex items-center justify-center p-1 overflow-hidden">
                                        <img
                                            src={w.image}
                                            alt="Watermark preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    </div>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleClearImage}
                                    >
                                        <i className="fas fa-trash-alt"></i> {t('common.remove')}
                                    </button>
                                </div>
                            ) : (
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="input-field"
                                    onChange={handleImageUpload}
                                />
                            )}
                        </div>
                    )}

                    {/* Common Controls */}
                    <div className="grid grid-cols-2 gap-md">
                        <div className="form-group">
                            <label className="form-label" htmlFor="watermark-position">{t('watermark.position')}</label>
                            <select
                                id="watermark-position"
                                className="select-field"
                                value={String(w.position || 'bottom-right')}
                                onChange={handlePositionChange}
                            >
                                {Object.values(WATERMARK_POSITIONS).map(pos => (
                                    <option key={pos} value={pos}>
                                        {t(`watermark.position.${pos}`)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="watermark-size">{t('watermark.size')}</label>
                            <select
                                id="watermark-size"
                                className="select-field"
                                value={String(w.size || 'medium')}
                                onChange={handleSizeChange}
                            >
                                {Object.values(WATERMARK_SIZES).map(size => (
                                    <option key={size} value={size}>
                                        {t(`watermark.size.${size}`)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="watermark-opacity">
                            {t('watermark.opacity')}: {Math.round((w.opacity ?? 0.5) * 100)}%
                        </label>
                        <input
                            type="range"
                            id="watermark-opacity"
                            className="range-slider"
                            value={Math.round((Number(w.opacity) || 0.5) * 100)}
                            onChange={handleOpacityChange}
                            min={10}
                            max={100}
                            step={5}
                        />
                    </div>

                    {w.type === 'text' && (
                        <div className="grid grid-cols-2 gap-md">
                            <div className="form-group">
                                <label className="form-label" htmlFor="watermark-fontSize">{t('watermark.fontSize')}</label>
                                <input
                                    type="number"
                                    id="watermark-fontSize"
                                    className="input-field"
                                    value={Number(w.fontSize) || 24}
                                    onChange={handleFontSizeChange}
                                    min={8}
                                    max={120}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="watermark-color font-normal">{t('watermark.color')}</label>
                                <div className="flex gap-sm items-center">
                                    <input
                                        type="color"
                                        id="watermark-color"
                                        className="color-picker-small"
                                        value={String(w.color || '#ffffff')}
                                        onChange={handleColorChange}
                                    />
                                    <span className="text-sm font-mono">{(w.color ?? '#ffffff').toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WatermarkCard;

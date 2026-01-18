import React from 'react';
import { WATERMARK_FONTS } from '../constants';

interface FontSelectorProps {
    value: string;
    onChange: (font: string) => void;
    label?: string;
    className?: string;
}

/**
 * Reusable font selection component.
 * @component
 */
const FontSelector: React.FC<FontSelectorProps> = ({
    value,
    onChange,
    label,
    className = ''
}) => {
    return (
        <div className={`form-group ${className}`}>
            {label && <label className="form-label">{label}</label>}
            <select
                className="select-field font-selector-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ '--selected-font': value || 'Arial' } as React.CSSProperties}
            >
                {WATERMARK_FONTS.map(font => (
                    <option
                        key={font}
                        value={font}
                        className="font-selector-option"
                        style={{ '--option-font': font } as React.CSSProperties}
                    >
                        {font}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default FontSelector;

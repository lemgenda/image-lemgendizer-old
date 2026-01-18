import React from 'react';

interface FontSizeSelectorProps {
    value: number;
    onChange: (size: number) => void;
    label?: string;
    min?: number;
    max?: number;
    unit?: string;
    className?: string;
}

/**
 * Reusable font size selection component.
 * @component
 */
const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({
    value,
    onChange,
    label,
    min = 8,
    max = 200,
    unit = 'px',
    className = ''
}) => {
    return (
        <div className={`form-group ${className}`}>
            {label && <label className="form-label">{label}</label>}
            <div className="flex-center">
                <input
                    type="number"
                    className="form-control"
                    value={value}
                    onChange={(e) => onChange(parseInt(e.target.value, 10))}
                    min={min}
                    max={max}
                />
                {unit && <span className="ml-xs text-xs text-muted">{unit}</span>}
            </div>
        </div>
    );
};

export default FontSizeSelector;

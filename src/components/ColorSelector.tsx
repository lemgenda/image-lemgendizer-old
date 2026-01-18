import React from 'react';

interface ColorSelectorProps {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    className?: string;
}

/**
 * Reusable color selection component.
 * @component
 */
const ColorSelector: React.FC<ColorSelectorProps> = ({
    value,
    onChange,
    label,
    className = ''
}) => {
    return (
        <div className={`form-group ${className}`}>
            {label && <label className="form-label">{label}</label>}
            <div className="flex gap-sm align-center">
                <input
                    type="color"
                    className="form-control form-control-color"
                    value={value || '#ffffff'}
                    onChange={(e) => onChange(e.target.value)}
                />
                <span className="text-xs font-mono text-muted">{(value || '#ffffff').toUpperCase()}</span>
            </div>
        </div>
    );
};

export default ColorSelector;

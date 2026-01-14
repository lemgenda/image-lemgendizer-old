/**
 * @file RangeSliderElement.tsx
 * @description Custom range slider component with progress tracking and tick marks.
 */
import { useId } from 'react';
import { COMPRESSION_QUALITY_RANGE, NUMBER_INPUT_CONSTANTS } from '../constants';
import { calculatePercentage, generateTicks } from '../utils';
import '../styles/RangeSliderElement.css';

interface RangeSliderElementProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  onChange: (value: number) => void;
  label?: string;
  id?: string;
  unit?: string;
  showTicks?: boolean;
}

/**
 * RangeSliderElement component.
 * @component
 * @param {RangeSliderElementProps} props - Component props.
 * @returns {JSX.Element} The rendered range slider.
 */
function RangeSliderElement({
  min = COMPRESSION_QUALITY_RANGE.MIN,
  max = COMPRESSION_QUALITY_RANGE.MAX,
  step = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT,
  value = COMPRESSION_QUALITY_RANGE.DEFAULT,
  onChange,
  label,
  id,
  unit = '%',
  showTicks = true
}: RangeSliderElementProps) {
  const percentage = calculatePercentage(min, max, value);
  const ticks = generateTicks(min, max);
  const uniqueId = useId();
  const inputId = id || `range-slider-${uniqueId}`;

  return (
    <div className="range-component">
      {label && (
        <div className="range-header">
          <label className="form-label" htmlFor={inputId}>{label}</label>
          <span className="range-value">
            {value}{unit}
          </span>
        </div>
      )}

      <input
        type="range"
        id={inputId}
        className="range-input"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--range-progress': `${percentage}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      {showTicks && (
        <div className="range-ticks">
          {ticks.map(tick => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default RangeSliderElement;

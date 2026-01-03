import { useId } from 'react';
import { COMPRESSION_QUALITY_RANGE, NUMBER_INPUT_CONSTANTS } from '../constants';
import { calculatePercentage, generateTicks } from '../utils';
import '../styles/RangeSliderElement.css';

/**
 * RangeSliderElement component for selecting values within a range
 * @component
 * @param {Object} props - Component props
 * @param {number} [props.min=COMPRESSION_QUALITY_RANGE.MIN] - Minimum value
 * @param {number} [props.max=COMPRESSION_QUALITY_RANGE.MAX] - Maximum value
 * @param {number} [props.step=NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT] - Step value
 * @param {number} [props.value=COMPRESSION_QUALITY_RANGE.DEFAULT] - Current value
 * @param {Function} props.onChange - Change handler function
 * @param {string} [props.label] - Label for the slider
 * @param {string} [props.unit='%'] - Unit to display with value
 * @param {boolean} [props.showTicks=true] - Whether to show tick marks
 * @returns {JSX.Element} Range slider component
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
}) {
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
        style={{ '--range-progress': `${percentage}%` }}
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
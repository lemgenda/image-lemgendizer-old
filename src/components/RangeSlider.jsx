import { useTranslation } from 'react-i18next';
import { calculatePercentage, generateTicks } from '../utils';

/**
 * A customizable range slider component with visual feedback and tick marks.
 */
function RangeSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  unit = '%',
  showTicks = true
}) {
  const { t } = useTranslation();
  const percentage = calculatePercentage(min, max, value);
  const ticks = generateTicks(min, max);

  return (
    <>
      <style>{`
        .range-component {
          width: 100%;
        }

        .range-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .range-value {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--color-primary);
        }

        .range-input {
          width: 100%;
          height: 8px;
          border-radius: 9999px;
          appearance: none;
          -webkit-appearance: none;
          cursor: pointer;
          outline: none;
          transition: background 120ms linear;

          background: linear-gradient(
            to right,
            var(--color-primary) 0%,
            var(--color-primary) var(--range-progress, 50%),
            var(--color-bg-tertiary) var(--range-progress, 50%),
            var(--color-bg-tertiary) 100%
          );
        }

        /* WebKit thumb */
        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-primary);
          border: 3px solid white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          transition: transform 120ms ease;
        }

        .range-input::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        /* Firefox thumb */
        .range-input::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--color-primary);
          border: 3px solid white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        }

        /* Firefox track normalization */
        .range-input::-moz-range-track {
          background: transparent;
          height: 8px;
        }

        .range-input::-moz-range-progress {
          background: transparent;
        }

        /* Keyboard focus */
        .range-input:focus-visible {
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
        }

        /* Tick marks */
        .range-ticks {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 6px;
          padding: 0 2px;
        }

        .form-label {
          display: block;
          margin-bottom: var(--space-sm);
          color: var(--color-text-secondary);
          font-weight: 500;
          font-size: 0.875rem;
        }
      `}</style>

      <div className="range-component">
        {label && (
          <div className="range-header">
            <label className="form-label">{label}</label>
            <span className="range-value">
              {value}{unit}
            </span>
          </div>
        )}

        <input
          type="range"
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
    </>
  )
}

export default RangeSlider
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ProgressUI.css';

interface ProgressUIProps {
    progress: number;
    step: string;
    fileName?: string;
    currentFileIndex?: number;
    totalFiles?: number;
    currentEnhancementIndex?: number;
    totalEnhancements?: number;
    currentTile?: number;
    totalTiles?: number;
    startTime?: number;
    aiLoading?: boolean;
}

const ProgressUI: React.FC<ProgressUIProps> = ({
    progress,
    step,
    fileName,
    currentFileIndex,
    totalFiles,
    currentEnhancementIndex,
    totalEnhancements,
    currentTile,
    totalTiles,
    startTime,
    aiLoading
}) => {
    const { t } = useTranslation();
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) {
            return;
        }

        // Update immediately (async) to prevent stale state display
        setTimeout(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 0);

        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    return (
        <div className="detailed-progress">
            {fileName && (
                <div className="progress-filename" title={fileName}>
                    <i className="fas fa-file-image mr-2"></i>
                    {fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName}
                </div>
            )}

            {aiLoading && (
                <div className="ai-active-indicator animate-pulse mb-3">
                    <i className="fas fa-brain fa-spin text-primary mr-2"></i>
                    <span className="text-sm font-semibold">{t('loading.aiProcessing') || 'AI Processing...'}</span>
                </div>
            )}


            <div className="progress-stats-grid">
                {currentFileIndex !== undefined && totalFiles !== undefined && (
                    <div className="stat-item">
                        <span className="stat-label">{t('processing.file')}:</span>
                        <span className="stat-value">{currentFileIndex} / {totalFiles}</span>
                    </div>
                )}
                {currentEnhancementIndex !== undefined && totalEnhancements !== undefined && (
                    <div className="stat-item">
                        <span className="stat-label">{t('processing.enhancement') || 'Enhancement'}:</span>
                        <span className="stat-value">{currentEnhancementIndex} / {totalEnhancements}</span>
                    </div>
                )}
                {currentTile !== undefined && totalTiles !== undefined && (
                    <div className="stat-item">
                        <span className="stat-label">{t('processing.tile') || 'Tile'}:</span>
                        <span className="stat-value">{currentTile} / {totalTiles}</span>
                    </div>
                )}
                {startTime !== undefined && (
                    <div className="stat-item">
                        <span className="stat-label">{t('processing.time') || 'Time'}:</span>
                        <span className="stat-value">{formatTime(elapsed)}</span>
                    </div>
                )}
            </div>

            <div className="progress-bar-wrapper mt-4">
                <div className="progress-bar-container">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="progress-info">
                    <span className="progress-step">{step}</span>
                    <span className="progress-percentage">
                        {typeof progress === 'number' ? (Math.round(progress * 100) / 100).toFixed(2).replace(/\.00$/, '') : progress}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ProgressUI;

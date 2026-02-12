import React, { useState } from 'react';
import '../styles/RestorationCard.css';

interface RestorationCardProps {
    selectedModels: string[];
    onOptionChange: (category: string, key: string, value: any) => void;
    t: (key: string, params?: any) => string;
}

const RestorationCard = ({
    selectedModels,
    onOptionChange,
    t
}: RestorationCardProps) => {
    const [draggedModelId, setDraggedModelId] = useState<string | null>(null);

    const models = [
        { id: 'MPRNet-Deraining', label: 'restoration.model.deraining', desc: 'restoration.desc.deraining', icon: 'fa-cloud-rain' },
        { id: 'FFANet-Dehazing(Indoor)', label: 'restoration.model.dehazing_indoor', desc: 'restoration.desc.dehazing_indoor', icon: 'fa-home' },
        { id: 'FFANet-Dehazing(Outdoor)', label: 'restoration.model.dehazing_outdoor', desc: 'restoration.desc.dehazing_outdoor', icon: 'fa-tree' },
        { id: 'MIRNet(v2)-LowLight', label: 'restoration.model.lowlight', desc: 'restoration.desc.lowlight', icon: 'fa-moon' },
        { id: 'NAFNet-Debluring(REDS)', label: 'restoration.model.image-deblurring', desc: 'restoration.desc.deblurring_reds', icon: 'fa-wind' },
        { id: 'NAFNet-Denoising', label: 'restoration.model.denoising', desc: 'restoration.desc.denoising_sidd', icon: 'fa-eye-slash' },
        { id: 'CodeFormer', label: 'restoration.model.face_restoration_codeformer', desc: 'restoration.desc.face_restoration_codeformer', icon: 'fa-user-check' },
    ];

    const handleModelToggle = (id: string) => {
        const isSelected = selectedModels.includes(id);
        let newSelected: string[];

        if (isSelected) {
            newSelected = selectedModels.filter(m => m !== id);
        } else {
            // Round 30: UI Selection Safety (Auto-Order)
            // If adding "Denoise", put it BEFORE any "Deblur".
            // If adding "Deblur", put it AFTER any "Denoise".
            const isDenoise = id.toLowerCase().includes('denoising') || id.toLowerCase().includes('lowlight') || id.toLowerCase().includes('mirnet');
            const isDeblur = id.toLowerCase().includes('deblur');

            if (isDenoise) {
                // Find first Deblur to insert before
                const firstDeblurIndex = selectedModels.findIndex(m => m.toLowerCase().includes('deblur'));
                if (firstDeblurIndex !== -1) {
                    newSelected = [...selectedModels];
                    newSelected.splice(firstDeblurIndex, 0, id);
                } else {
                    newSelected = [...selectedModels, id];
                }
            } else if (isDeblur) {
                // Deblur goes to end (safest)
                newSelected = [...selectedModels, id];
            } else {
                newSelected = [...selectedModels, id];
            }
        }

        onOptionChange('restoration', 'selectedModels', newSelected);
        onOptionChange('restoration', 'modelName', newSelected[0] || '');
        // Implicitly enable/disable based on selection
        onOptionChange('restoration', 'enabled', newSelected.length > 0);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (!selectedModels.includes(id)) return;
        setDraggedModelId(id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (!draggedModelId || draggedModelId === id || !selectedModels.includes(id)) return;

        const newSelected = [...selectedModels];
        const draggedIndex = newSelected.indexOf(draggedModelId);
        const targetIndex = newSelected.indexOf(id);

        newSelected.splice(draggedIndex, 1);
        newSelected.splice(targetIndex, 0, draggedModelId);

        // Round 30: UI Safety Gate
        // Prevent user from dragging Deblur BEFORE Denoise.
        const firstDeblur = newSelected.findIndex(m => m.toLowerCase().includes('deblur'));

        let lastDenoise = -1;
        for (let i = newSelected.length - 1; i >= 0; i--) {
            const m = newSelected[i].toLowerCase();
            if (m.includes('denoising') || m.includes('lowlight') || m.includes('mirnet')) {
                lastDenoise = i;
                break;
            }
        }

        if (firstDeblur !== -1 && lastDenoise !== -1) {
            if (firstDeblur < lastDenoise) {
                // Invalid state: Deblur is before Denoise.
                // Reject the drag (do not update state).
                return;
            }
        }

        onOptionChange('restoration', 'selectedModels', newSelected);
        onOptionChange('restoration', 'modelName', newSelected[0] || '');
    };

    const handleDragEnd = () => {
        setDraggedModelId(null);
    };

    const sortedModels = [...models].sort((a, b) => {
        const aIndex = selectedModels.indexOf(a.id);
        const bIndex = selectedModels.indexOf(b.id);

        const aSelected = aIndex !== -1;
        const bSelected = bIndex !== -1;

        if (aSelected && bSelected) return aIndex - bIndex;
        if (aSelected) return -1;
        if (bSelected) return 1;

        return t(a.label).localeCompare(t(b.label));
    });

    return (
        <div className="card restoration-card h-full">
            <div className="card-header border-b border-border pb-3 mb-4">
                <h3 className="card-title mb-0 flex items-center">
                    <i className="fas fa-magic mr-2 text-primary"></i>
                    {t('restoration.title')}
                </h3>
            </div>
            <div className="card-body">
                <p className="text-sm text-muted mb-4 px-md">
                    {t('restoration.description')}
                </p>
                <div className="restoration-list">
                    {sortedModels.map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        const selectionOrder = selectedModels.indexOf(model.id) + 1;

                        return (
                            <div
                                key={model.id}
                                draggable={isSelected}
                                onDragStart={(e) => handleDragStart(e, model.id)}
                                onDragOver={(e) => handleDragOver(e, model.id)}
                                onDragEnd={handleDragEnd}
                                className={`restoration-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleModelToggle(model.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        handleModelToggle(model.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                data-testid={`restoration-option-${model.id}`}
                            >
                                <div className="restoration-item-icon-wrapper">
                                    {isSelected && <span className="restoration-order-badge">{selectionOrder}</span>}
                                    <i className={`fas ${model.icon} restoration-item-icon`}></i>
                                </div>
                                <div className="restoration-item-content">
                                    <div className="restoration-item-header">
                                        <span className="restoration-item-label">
                                            {t(model.label)}
                                        </span>
                                        {isSelected && (
                                            <i className="fas fa-grip-vertical restoration-grip"></i>
                                        )}
                                    </div>
                                    <div className="restoration-item-desc">
                                        {t(model.desc)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {selectedModels.includes('CodeFormer') && (
                    <div className="restoration-settings mt-4 px-md">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">
                                {t('restoration.label.fidelity')}
                            </label>
                            <span className="text-sm font-bold text-primary">
                                {(selectedModels.find(m => m === 'CodeFormer') ? '0.9' : '1.0')}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.8"
                            max="1.0"
                            step="0.05"
                            defaultValue="0.9"
                            onChange={(e) => onOptionChange('restoration', 'fidelity', parseFloat(e.target.value))}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                            data-testid="codeformer-fidelity-slider"
                        />
                        <div className="flex justify-between text-[10px] text-muted mt-1 uppercase tracking-wider">
                            <span>Balance</span>
                            <span>High Fidelity</span>
                        </div>
                    </div>
                )}
                {selectedModels.length > 1 && (
                    <div className="restoration-info-box">
                        <i className="fas fa-info-circle"></i>
                        <span className="restoration-info-text">
                            {t('restoration.sequential_info', { count: selectedModels.length })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RestorationCard;

import React from 'react';

interface RestorationCardProps {
    modelName: string;
    enabled: boolean;
    onOptionChange: (category: string, key: string, value: any) => void;
    t: (key: string) => string;
}

const RestorationCard = ({
    modelName,
    enabled,
    onOptionChange,
    t
}: RestorationCardProps) => {

    const handleModelChange = (id: string) => {
        if (!enabled) {
            onOptionChange('restoration', 'enabled', true);
        }
        onOptionChange('restoration', 'modelName', id);
    };

    const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        onOptionChange('restoration', 'enabled', e.target.checked);
    };

    const models = [
        { id: 'MPRNet-Deraining', label: 'restoration.model.deraining', desc: 'restoration.desc.deraining', icon: 'fa-cloud-rain' },
        // V88: Standardized labels and descriptions (User Request: "try with fp32 dehaze")
        { id: 'FFANet-Dehazing(Indoor)', label: 'restoration.model.dehazing_indoor', desc: 'restoration.desc.dehazing_indoor', icon: 'fa-home' },
        { id: 'FFANet-Dehazing(Outdoor)', label: 'restoration.model.dehazing_outdoor', desc: 'restoration.desc.dehazing_outdoor', icon: 'fa-tree' },
        { id: 'MIRNetV2-LowLight', label: 'restoration.model.lowlight', desc: 'restoration.desc.lowlight', icon: 'fa-moon' },
        // V78: Promoting NAFNet REDS as the definitive deblurrer based on user feedback.
        { id: 'NAFNet-Debluring(REDS)', label: 'restoration.model.image-deblurring', desc: 'restoration.desc.deblurring_reds', icon: 'fa-wind' },
        { id: 'NAFNet-Denoising', label: 'restoration.model.denoising', desc: 'restoration.desc.denoising_sidd', icon: 'fa-eye-slash' },
    ];

    return (
        <div className="card h-full">
            <div className="card-header flex justify-between items-center">
                <h3 className="card-title mb-0">
                    <i className="fas fa-magic mr-2 text-primary"></i>
                    {t('restoration.title')}
                </h3>
                <div className="form-check form-switch">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="restorationInfoToggle"
                        checked={enabled}
                        onChange={handleToggle}
                    />
                </div>
            </div>
            <div className={`card-body ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('restoration.description')}
                </p>
                <div className="space-y-3">
                    {models.map(model => (
                        <div
                            key={model.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${modelName === model.id
                                ? 'border-primary bg-primary-light ring-2 ring-primary ring-opacity-50'
                                : 'border-border hover:border-gray-400'
                                }`}
                            onClick={() => handleModelChange(model.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleModelChange(model.id);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            data-testid={`restoration-option-${model.id}`}
                        >
                            <div className="flex items-center mb-1">
                                <i className={`fas ${model.icon} mr-3 w-6 text-center ${modelName === model.id ? 'text-primary' : 'text-gray-500'}`}></i>
                                <span className="font-semibold">{t(model.label)}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 pl-9">
                                {t(model.desc)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
};

export default RestorationCard;

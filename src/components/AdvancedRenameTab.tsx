/**
 * @file AdvancedRenameTab.tsx
 * @description Tab component for batch renaming images with pattern support and live preview.
 */
import type { ProcessingOptions, ImageFile } from '../types';
import { useTranslation } from 'react-i18next';

import '../styles/AdvancedRenameTab.css';

interface AdvancedRenameTabProps {
    processingOptions: ProcessingOptions;
    selectedImagesForProcessing: ImageFile[];
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    onApplyToCustom: () => void;
    isLoading: boolean;
    processImages: () => Promise<void>;
    selectedImagesCount: number;
}

/**
 * AdvancedRenameTab component.
 * @component
 * @param {AdvancedRenameTabProps} props - Component props.
 * @returns {JSX.Element} The rendered rename tab.
 */
const AdvancedRenameTab = ({
    processingOptions,
    onOptionChange,
    onApplyToCustom,
    isLoading,
    processImages,
    selectedImagesCount
}: AdvancedRenameTabProps) => {
    const { t } = useTranslation();


    const handleRenameChange = (key: string, value: any) => {
        onOptionChange('batchRename', key, value);
    };

    const renameOptions = processingOptions.batchRename || {
        pattern: '{name}',
        find: '',
        replace: '',
        useRegex: false,
        casing: 'original',
        startSequence: 1,
        stepSequence: 1,
        zerosPadding: 3,
        dateFormat: 'YYYY-MM-DD'
    };

    const insertToken = (token: string) => {
        const currentPattern = renameOptions.pattern;
        handleRenameChange('pattern', currentPattern + token);
    };

    return (
        <div className="tab-pane animate-fade-in">
            <div className="flex flex-col mb-lg">

                {/* Naming Rules Accordion */}
                <details className="settings-accordion" name="rename-settings">
                    <summary style={{ outline: 'none' }}>
                        <div className="flex items-center gap-sm" data-testid="rename-pattern-title">
                            <i className="fas fa-tag text-primary flex-shrink-0"></i>
                            <span>{t('rename.patternTitle')}</span>
                        </div>
                        <i className="fas fa-chevron-down text-sm"></i>
                    </summary>
                    <div className="card-body">

                        <div className="form-group mb-4">
                            <label htmlFor="renamePattern" className="block text-sm font-medium mb-1">
                                {t('rename.pattern')}
                            </label>
                            <input
                                type="text"
                                id="renamePattern"
                                data-testid="rename-pattern-input"
                                className="input-field w-full"
                                value={renameOptions.pattern}
                                onChange={(e) => handleRenameChange('pattern', e.target.value)}
                                placeholder={t('rename.patternPlaceholder')}
                            />
                        </div>

                        <div className="flex flex-col mb-lg">
                            <div className="flex flex-wrap gap-2 mb-2">
                                <button onClick={() => insertToken('{name}')} className="badge badge-primary">
                                    {'{name}'}
                                </button>
                                <button onClick={() => insertToken('{counter}')} className="badge badge-primary">
                                    {'{counter}'}
                                </button>
                                <button onClick={() => insertToken('{size}')} className="badge badge-primary">
                                    {'{size}'}
                                </button>
                                <button onClick={() => insertToken('{year}')} className="badge badge-primary">
                                    {'{year}'}
                                </button>
                                <button onClick={() => insertToken('{time}')} className="badge badge-primary">
                                    {'{time}'}
                                </button>
                                <button onClick={() => insertToken('{date}')} className="badge badge-primary">
                                    {'{date}'}
                                </button>
                                <button onClick={() => insertToken('{ext}')} className="badge badge-secondary">
                                    {'{ext}'}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-muted">
                            {t('rename.tokenHelp')}
                        </p>
                    </div>
                </details>

                {/* Find & Replace Accordion */}
                <details className="settings-accordion" name="rename-settings">
                    <summary style={{ outline: 'none' }}>
                        <div className="flex items-center gap-sm">
                            <i className="fas fa-search text-primary flex-shrink-0"></i>
                            <span>{t('rename.replaceTitle')}</span>
                        </div>
                        <i className="fas fa-chevron-down text-sm"></i>
                    </summary>
                    <div className="card-body">

                        <div className="form-group mb-3">
                            <label htmlFor="renameFind" className="block text-sm font-medium mb-1">
                                {t('rename.find')}
                            </label>
                            <input
                                type="text"
                                id="renameFind"
                                className="input-field w-full"
                                value={renameOptions.find}
                                onChange={(e) => handleRenameChange('find', e.target.value)}
                                placeholder={t('rename.findPlaceholder')}
                            />
                        </div>

                        <div className="form-group mb-3">
                            <label htmlFor="renameReplace" className="block text-sm font-medium mb-1">
                                {t('rename.replace')}
                            </label>
                            <input
                                type="text"
                                id="renameReplace"
                                className="input-field w-full"
                                value={renameOptions.replace}
                                onChange={(e) => handleRenameChange('replace', e.target.value)}
                                placeholder={t('rename.replacePlaceholder')}
                            />
                        </div>

                        <div className="form-checkbox flex items-center">
                            <input
                                type="checkbox"
                                id="useRegex"
                                checked={renameOptions.useRegex}
                                onChange={(e) => handleRenameChange('useRegex', e.target.checked)}
                                className="checkbox mr-2"
                            />
                            <label htmlFor="useRegex" className="text-sm cursor-pointer select-none">
                                {t('rename.useRegex')}
                            </label>
                        </div>
                    </div>
                </details>

                {/* Options Accordion */}
                <details className="settings-accordion" name="rename-settings">
                    <summary style={{ outline: 'none' }}>
                        <div className="flex items-center gap-sm">
                            <i className="fas fa-sliders-h text-primary flex-shrink-0"></i>
                            <span>{t('rename.optionsTitle')}</span>
                        </div>
                        <i className="fas fa-chevron-down text-sm"></i>
                    </summary>
                    <div className="card-body">

                        <div className="form-group mb-3">
                            <label htmlFor="renameCasing" className="block text-sm font-medium mb-1">
                                {t('rename.casing')}
                            </label>
                            <select
                                id="renameCasing"
                                className="select-field w-full"
                                value={renameOptions.casing}
                                onChange={(e) => handleRenameChange('casing', e.target.value)}
                            >
                                <option value="original">{t('rename.case.original')}</option>
                                <option value="lowercase">{t('rename.case.lowercase')}</option>
                                <option value="uppercase">{t('rename.case.uppercase')}</option>
                                <option value="camelCase">{t('rename.case.camelCase')}</option>
                                <option value="kebabCase">{t('rename.case.kebabCase')}</option>
                                <option value="snakeCase">{t('rename.case.snakeCase')}</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-group">
                                <label htmlFor="renameStartSeq" className="block text-sm font-medium mb-1">
                                    {t('rename.startSeq')}
                                </label>
                                <input
                                    type="number"
                                    id="renameStartSeq"
                                    min="0"
                                    className="input-field w-full"
                                    value={renameOptions.startSequence}
                                    onChange={(e) => handleRenameChange('startSequence', parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="renamePadding" className="block text-sm font-medium mb-1">
                                    {t('rename.padding')}
                                </label>
                                <input
                                    type="number"
                                    id="renamePadding"
                                    min="1"
                                    max="10"
                                    className="input-field w-full"
                                    value={renameOptions.zerosPadding}
                                    onChange={(e) => handleRenameChange('zerosPadding', parseInt(e.target.value) || 1)}
                                />
                            </div>
                        </div>
                    </div>
                </details>


                {/* Actions Row */}
                <div className="mt-auto" style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                    <button
                        className="btn btn-primary w-full mb-sm"
                        onClick={processImages}
                        disabled={isLoading || selectedImagesCount === 0}
                    >
                        <i className="fas fa-cog"></i>
                        {isLoading ? t('button.processing') : `${t('button.process')} (${selectedImagesCount})`}
                    </button>
                    <button
                        onClick={onApplyToCustom}
                        data-testid="apply-to-custom-btn"
                        className="btn btn-secondary w-full font-semibold"
                        disabled={isLoading}
                    >
                        <i className="fas fa-exchange-alt mr-2"></i>
                        {t('rename.applyToCustom')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdvancedRenameTab;

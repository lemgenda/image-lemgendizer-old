/**
 * @file AdvancedRenameTab.tsx
 * @description Tab component for batch renaming images with pattern support and live preview.
 */
import type { ProcessingOptions, ImageFile } from '../types';
import { useTranslation } from 'react-i18next';

import { generateNewFileName } from '../utils/renameUtils';
import '../styles/AdvancedRenameTab.css';

interface AdvancedRenameTabProps {
    processingOptions: ProcessingOptions;
    selectedImagesForProcessing: ImageFile[];
    onOptionChange: (category: keyof ProcessingOptions, key: string, value: any) => void;
    onApplyToCustom: () => void;
    onProcess: () => void;
    isLoading: boolean;
}

/**
 * AdvancedRenameTab component.
 * @component
 * @param {AdvancedRenameTabProps} props - Component props.
 * @returns {JSX.Element} The rendered rename tab.
 */
const AdvancedRenameTab = ({
    processingOptions,
    selectedImagesForProcessing,
    onOptionChange,
    onApplyToCustom,
    onProcess,
    isLoading
}: AdvancedRenameTabProps) => {
    const { t } = useTranslation();
    const previewImages = selectedImagesForProcessing;

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
            {/* Header / Actions Section */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold">{t('batchRename.title')}</h2>
                    <p className="text-sm text-muted">{t('batchRename.description')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Column: Naming Rules */}
                <div className="space-y-6">

                    {/* Pattern Section */}
                    <div className="card p-4">
                        <h3 className="text-lg font-semibold mb-3 flex items-center" data-testid="rename-pattern-title">
                            <i className="fas fa-tag mr-2 text-primary"></i>
                            {t('rename.patternTitle')}
                        </h3>

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

                        <div className="flex flex-wrap gap-2 mb-2">
                            <button onClick={() => insertToken('{name}')} className="badge badge-primary">
                                {'{name}'}
                            </button>
                            <button onClick={() => insertToken('{counter}')} className="badge badge-primary">
                                {'{counter}'}
                            </button>
                            <button onClick={() => insertToken('{date}')} className="badge badge-primary">
                                {'{date}'}
                            </button>
                            <button onClick={() => insertToken('{ext}')} className="badge badge-secondary">
                                {'{ext}'}
                            </button>
                        </div>
                        <p className="text-xs text-muted">
                            {t('rename.tokenHelp')}
                        </p>
                    </div>

                    {/* Find & Replace Section */}
                    <div className="card p-4">
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <i className="fas fa-search mr-2 text-primary"></i>
                            {t('rename.replaceTitle')}
                        </h3>

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
                </div>

                {/* Right Column: Formatting & Output */}
                <div className="space-y-6">
                    {/* Options Section */}
                    <div className="card p-4">
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <i className="fas fa-sliders-h mr-2 text-primary"></i>
                            {t('rename.optionsTitle')}
                        </h3>

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

                    {/* Rename Preview Section */}
                    <div className="card p-4 flex-grow flex flex-col min-h-0">
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <i className="fas fa-eye mr-2 text-primary"></i>
                            {t('rename.previewTitle')}
                        </h3>

                        <div className="overflow-auto border rounded border-gray-100 dark:border-gray-800 rename-preview-list">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium">{t('common.hashSymbol')}</th>
                                        <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium">{t('rename.originalName')}</th>
                                        <th className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 font-medium text-primary">{t('rename.newName')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewImages.length > 0 ? (
                                        previewImages.map((img, idx) => (
                                            <tr key={img.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 text-muted">{idx + 1}</td>
                                                <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 truncate max-w-[150px]" title={img.name}>
                                                    {img.name}
                                                </td>
                                                <td className="px-3 py-2 border-b border-gray-50 dark:border-gray-800 font-medium text-primary">
                                                    {generateNewFileName(img.name, idx, renameOptions)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-8 text-center text-muted">
                                                {t('rename.noSelectedImages')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-muted mt-3">
                            {t('rename.previewInfo')}
                        </p>
                    </div>

                    {/* Actions Row */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                        <button
                            onClick={onApplyToCustom}
                            data-testid="apply-to-custom-btn"
                            className="btn btn-secondary btn-lg flex-1 font-semibold mb-2 sm:mb-0"
                            disabled={isLoading}
                        >
                            <i className="fas fa-exchange-alt mr-2"></i>
                            {t('rename.applyToCustom')}
                        </button>
                        <button
                            onClick={onProcess}
                            className="btn btn-primary btn-lg flex-1 font-bold"
                            disabled={previewImages.length === 0 || isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2"></i>
                                    {t('button.processing')}
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save mr-2"></i>
                                    {t('rename.processBtn')}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdvancedRenameTab;

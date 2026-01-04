import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getProcessingConfiguration,
    createExportZip,
    createScreenshotZip,
    downloadZip,
    generateExportSettings
} from '../processors';
import {
    createImageObjects,
    createProcessingSummary,
    cleanupBlobUrls,
    loadUTIFLibrary,
    captureMultipleScreenshots,
    convertScreenshotResultsToImages,
    validateScreenshotUrlInput,
    validateImageFilesBeforeProcessing,
    handleProcessingError,
    calculateCategoriesApplied,
    getSelectedImagesForProcessing,
    orchestrateCustomProcessing,
    orchestrateTemplateProcessing,
    setupAutoClose,
    getImageDimensions,
    safeCleanupGPUMemory,
    generateSpecialFormatPreview,
    checkImageTransparencyQuick
} from '../utils';
import {
    getTemplateCategories,
    SOCIAL_MEDIA_TEMPLATES,
    SCREENSHOT_TEMPLATES,
    DEFAULT_FAVICON_BACKGROUND_COLOR,
    DEFAULT_FAVICON_SITE_NAME,
    DEFAULT_FAVICON_THEME_COLOR,
    FAVICON_SIZES,
    FAVICON_SIZES_BASIC,
    APP_TEMPLATE_CONFIG,
    EXPORT_SETTINGS
} from '../configs/templateConfigs';
import {
    PROCESSING_MODES,
    COMPRESSION_QUALITY_RANGE,
    CROP_MODES,
    ALL_OUTPUT_FORMATS,
    DEFAULT_PROCESSING_CONFIG,
    MODAL_TYPES,
    NUMBER_INPUT_CONSTANTS,
    IMAGE_FORMATS,
    CROP_POSITIONS,
    CROP_POSITION_LIST,
    RESIZE_DIMENSION_RANGE,
    CROP_DIMENSION_RANGE,
    PROCESSING_DELAYS,
    SUPPORTED_INPUT_FORMATS,
    FILE_EXTENSIONS
} from '../constants';

const ProcessingContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useProcessingContext = () => {
    const context = useContext(ProcessingContext);
    if (!context) {
        throw new Error('useProcessingContext must be used within a ProcessingProvider');
    }
    return context;
};

export const ProcessingProvider = ({ children }) => {
    const { t } = useTranslation();
    const [isScreenshotMode, setIsScreenshotMode] = useState(false);
    const [isFaviconSelected, setIsFaviconSelected] = useState(false);
    const [isScreenshotSelected, setIsScreenshotSelected] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [screenshotResults, setScreenshotResults] = useState(null);
    const [isCapturingScreenshots, setIsCapturingScreenshots] = useState(false);
    const [captureProgress, setCaptureProgress] = useState(0);
    const [screenshotValidation, setScreenshotValidation] = useState({
        isValid: false,
        message: ''
    });
    const [selectedScreenshotTemplates, setSelectedScreenshotTemplates] = useState([
        'screenshots-mobile',
        'screenshots-desktop'
    ]);
    const [processedImages, setProcessedImages] = useState([]);
    const [images, setImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState([]);
    const [modal, setModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: MODAL_TYPES.INFO,
        showProgress: false,
        progress: 0,
        progressStep: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [aiModelLoaded, setAiModelLoaded] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [processingSummary, setProcessingSummary] = useState(null);
    const [processingOptions, setProcessingOptions] = useState({
        ...DEFAULT_PROCESSING_CONFIG,
        compression: {
            ...DEFAULT_PROCESSING_CONFIG.compression,
            quality: COMPRESSION_QUALITY_RANGE.DEFAULT
        },
        output: {
            ...DEFAULT_PROCESSING_CONFIG.output,
            formats: [IMAGE_FORMATS.WEBP]
        },
        batchRename: {
            pattern: '{name}',
            find: '',
            replace: '',
            useRegex: false,
            casing: 'original',
            startSequence: 1,
            stepSequence: 1,
            zerosPadding: 3,
            dateFormat: 'YYYY-MM-DD'
        }
    });
    // userInteractedWithModal state removed


    // Refs
    const autoCloseTimeoutRef = useRef(null);
    const fileInputRef = useRef(null);

    // Initial Effects
    useEffect(() => {
        return () => {
            if (autoCloseTimeoutRef.current) {
                clearTimeout(autoCloseTimeoutRef.current);
                autoCloseTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const preloadLibraries = async () => {
            try {
                await loadUTIFLibrary();
            } catch {
                // ignore
            }
        };
        preloadLibraries();
    }, [processingOptions.processingMode, screenshotUrl, t]);

    const closeModal = useCallback(() => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
        }

        setModal({
            isOpen: false,
            title: '',
            message: '',
            type: MODAL_TYPES.INFO,
            showProgress: false,
            progress: 0,
            progressStep: ''
        });
        setProcessingSummary(null);
    }, []);

    const showModal = useCallback((title, message, type = MODAL_TYPES.INFO, showProgress = false, progress = 0, progressStep = '') => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
        }

        setModal({
            isOpen: true,
            title,
            message,
            type,
            showProgress,
            progress,
            progressStep
        });

        if (!showProgress) {
            const autoClose = setupAutoClose(closeModal, type);
            autoCloseTimeoutRef.current = autoClose.ref;
        }
    }, [closeModal]);

    useEffect(() => {
        const loadAIModelIfNeeded = async () => {
            const needsAI = (processingOptions.cropMode === CROP_MODES.SMART && !aiModelLoaded) ||
                (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && !aiModelLoaded);

            if (!needsAI) return;

            try {
                setAiLoading(true);

                // Note: assuming path is correct relative to context folder.
                // Context is in src/context. utils is in src/utils.
                // So import should be from '../utils/memoryUtils'.
                // But in App.jsx it was './utils/memoryUtils'.
                const { loadAIModel } = await import('../utils/memoryUtils');
                const model = await loadAIModel();

                if (model && (model.modelType || typeof model.detect === 'function')) {
                    setAiModelLoaded(true);
                    setAiLoading(false);
                } else {
                    throw new Error('AI model failed to load');
                }
            } catch {

                setAiLoading(false);
                setAiModelLoaded(false);

                if (processingOptions.cropMode === CROP_MODES.SMART) {
                    setProcessingOptions(prev => ({
                        ...prev,
                        cropMode: CROP_MODES.STANDARD
                    }));
                }

                showModal(
                    t('message.warning'),
                    t('message.aiModelFailed'),
                    MODAL_TYPES.WARNING
                );
            }
        };

        loadAIModelIfNeeded();
    }, [processingOptions.cropMode, processingOptions.processingMode, t, aiModelLoaded, showModal]);

    // Track current images for cleanup on unmount
    const imagesRef = useRef(images);
    useEffect(() => {
        imagesRef.current = images;
    }, [images]);

    // Cleanup all blob URLs only when component unmounts
    useEffect(() => {
        return () => {
            if (imagesRef.current && imagesRef.current.length > 0) {
                cleanupBlobUrls(imagesRef.current);
            }
        };
    }, []);

    const handleModalInteraction = useCallback(() => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
        }
    }, []);

    const showSummaryModal = useCallback((summary) => {
        if (autoCloseTimeoutRef.current) {
            clearTimeout(autoCloseTimeoutRef.current);
            autoCloseTimeoutRef.current = null;
        }

        setProcessingSummary(summary);
        setModal({
            isOpen: true,
            title: t('summary.title'),
            message: '',
            type: MODAL_TYPES.SUMMARY,
            showProgress: false,
            progress: 0,
            progressStep: ''
        });

        const autoClose = setupAutoClose(closeModal, MODAL_TYPES.SUMMARY);
        autoCloseTimeoutRef.current = autoClose.ref;
    }, [t, closeModal]);

    // Handlers
    const updateProcessingModal = (progress, step, title = t('message.processing')) => {
        setModal({
            isOpen: true,
            title,
            message: step,
            type: MODAL_TYPES.INFO,
            showProgress: true,
            progress,
            progressStep: step
        });
    };

    const startProcessingModal = (message) => {
        setModal({
            isOpen: true,
            title: t('message.processing'),
            message: message,
            type: MODAL_TYPES.INFO,
            showProgress: true,
            progress: 0,
            progressStep: t('processing.initializing')
        });
    };

    const handleScreenshotUrlChange = (url) => {
        setScreenshotUrl(url);
        const validation = validateScreenshotUrlInput(url);
        setScreenshotValidation(validation);
    };

    const handleImageUpload = async (files) => {
        try {
            setIsLoading(true);

            const validFiles = Array.from(files).filter(file => {
                if (!file || !file.type) return false;

                const mimeType = file.type.toLowerCase();
                const fileName = file.name.toLowerCase();

                const isSupportedType = SUPPORTED_INPUT_FORMATS.some(type =>
                    mimeType === type || (type.includes('/') && mimeType.includes(type.split('/')[1]))
                );

                const allExtensions = Object.values(FILE_EXTENSIONS).flat();
                const hasSupportedExtension = allExtensions.some(ext => fileName.endsWith(ext));

                return isSupportedType || hasSupportedExtension;
            });

            if (validFiles.length === 0) {
                showModal(
                    t('message.error'),
                    t('message.noValidImages'),
                    MODAL_TYPES.ERROR
                );
                setIsLoading(false);
                return;
            }

            if (validFiles.length < files.length) {
                showModal(
                    t('message.warning'),
                    t('message.someFilesSkipped', {
                        valid: validFiles.length,
                        total: files.length
                    }),
                    MODAL_TYPES.WARNING
                );
            }

            const newImages = await createImageObjects(validFiles);

            const enhancedImages = await Promise.all(
                newImages.map(async (img) => {
                    try {
                        let previewUrl = img.url;

                        if (img.isTIFF || img.isSVG) {
                            try {
                                const canvasPreview = await generateSpecialFormatPreview(img);
                                previewUrl = canvasPreview;
                            } catch {
                                // ignore
                            }
                        }

                        if (!previewUrl || !previewUrl.startsWith('blob:') && !previewUrl.startsWith('data:')) {
                            previewUrl = URL.createObjectURL(img.file);
                        }

                        return {
                            ...img,
                            url: previewUrl,
                            previewGenerated: true,
                            previewType: img.isTIFF ? 'tiff' : img.isSVG ? 'svg' : 'regular',
                            uploadTime: Date.now(),
                            metadata: {
                                dimensions: await getImageDimensions(img.file, img.isTIFF, img.isSVG),
                                hasTransparency: await checkImageTransparencyQuick(img.file)
                            }
                        };
                    } catch (error) {
                        return {
                            ...img,
                            previewGenerated: false,
                            error: error.message
                        };
                    }
                })
            );

            // cleanupBlobUrls(images); // Removed to prevent revoking existing image URLs during append

            setImages(prev => [...prev, ...enhancedImages]);

            if (processingOptions.processingMode === PROCESSING_MODES.CUSTOM ||
                processingOptions.processingMode === PROCESSING_MODES.BATCH_RENAME) {
                if (selectedImages.length === 0 || processingOptions.processingMode === PROCESSING_MODES.BATCH_RENAME) {
                    const allNewIds = enhancedImages.map(img => img.id);
                    setSelectedImages(prev => [...new Set([...prev, ...allNewIds])]);
                } else {
                    setSelectedImages(prev => [...prev, ...enhancedImages.map(img => img.id)]);
                }
            }

            if ((processingOptions.processingMode === PROCESSING_MODES.TEMPLATES || processingOptions.showTemplates) &&
                !processingOptions.templateSelectedImage &&
                enhancedImages.length > 0) {
                setProcessingOptions(prev => ({
                    ...prev,
                    templateSelectedImage: enhancedImages[0].id
                }));
                setSelectedImages([enhancedImages[0].id]);
            }

            showModal(
                t('message.success'),
                t('message.successUpload', {
                    count: enhancedImages.length,
                    skipped: files.length - enhancedImages.length
                }),
                MODAL_TYPES.SUCCESS
            );

            // Note: scrolling logic removed or needs to be handled by UI component observing images length

        } catch (error) {
            showModal(
                t('message.error'),
                t('message.errorUpload') + ': ' + error.message,
                MODAL_TYPES.ERROR
            );
        } finally {
            setIsLoading(false);

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleImageSelect = (imageId) => {
        if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
            setProcessingOptions(prev => ({
                ...prev,
                templateSelectedImage: imageId
            }));
            setSelectedImages([imageId]);
        } else {
            setSelectedImages(prev =>
                prev.includes(imageId)
                    ? prev.filter(id => id !== imageId)
                    : [...prev, imageId]
            );
        }
    };

    const handleScreenshotTemplateToggle = (templateId) => {
        setSelectedScreenshotTemplates(prev => {
            if (prev.includes(templateId)) {
                return prev.filter(id => id !== templateId);
            } else {
                return [...prev, templateId];
            }
        });
    };

    const handleSelectAllScreenshotTemplates = () => {
        const allTemplateIds = Object.keys(SCREENSHOT_TEMPLATES || {});
        setSelectedScreenshotTemplates(allTemplateIds);
    };

    const handleDeselectAllScreenshotTemplates = () => {
        setSelectedScreenshotTemplates([]);
    };

    const handleSelectAll = () => {
        if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) return;
        if (selectedImages.length === images.length) {
            setSelectedImages([]);
        } else {
            setSelectedImages(images.map(img => img.id));
        }
    };

    const handleRemoveSelected = () => {
        const imagesToRemove = processingOptions.processingMode === PROCESSING_MODES.TEMPLATES
            ? [processingOptions.templateSelectedImage].filter(Boolean)
            : selectedImages;

        const imagesToRemoveObjects = images.filter(img => imagesToRemove.includes(img.id));
        cleanupBlobUrls(imagesToRemoveObjects);

        setImages(images.filter(img => !imagesToRemove.includes(img.id)));
        setSelectedImages([]);

        if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
            setProcessingOptions(prev => ({
                ...prev,
                templateSelectedImage: null
            }));
        }

        showModal(t('message.removed'), t('message.removedImages'), MODAL_TYPES.SUCCESS);
    };

    const handleFaviconToggle = (selected) => {
        setIsFaviconSelected(selected);
    };

    const handleScreenshotToggle = (selected) => {
        setIsScreenshotSelected(selected);
        if (!selected) {
            setScreenshotUrl('');
            setScreenshotValidation(null);
            setScreenshotResults(null);
        }
    };

    const toggleResizeCrop = () => {
        setProcessingOptions(prev => ({
            ...prev,
            showResize: !prev.showResize,
            showCrop: !prev.showCrop
        }));
    };

    const toggleCropMode = () => {
        if (processingOptions.cropMode === CROP_MODES.STANDARD) {
            setProcessingOptions(prev => ({
                ...prev,
                cropMode: CROP_MODES.SMART
            }));
        } else {
            setProcessingOptions(prev => ({
                ...prev,
                cropMode: CROP_MODES.STANDARD
            }));
        }
    };

    const handleFormatToggle = (format) => {
        setProcessingOptions(prev => {
            const currentFormats = prev.output.formats || [];
            const newFormats = currentFormats.includes(format)
                ? currentFormats.filter(f => f !== format)
                : [...currentFormats, format];

            if (newFormats.length === 0) return prev;

            return {
                ...prev,
                output: {
                    ...prev.output,
                    formats: newFormats
                }
            };
        });
    };

    const handleSelectAllFormats = () => {
        setProcessingOptions(prev => ({
            ...prev,
            output: {
                ...prev.output,
                formats: ALL_OUTPUT_FORMATS.filter(format => format !== IMAGE_FORMATS.ORIGINAL)
            }
        }));
    };

    const handleClearAllFormats = () => {
        setProcessingOptions(prev => ({
            ...prev,
            output: {
                ...prev.output,
                formats: [IMAGE_FORMATS.ORIGINAL]
            }
        }));
    };

    const toggleProcessingMode = (mode) => {
        const newMode = mode;

        if (newMode === PROCESSING_MODES.TEMPLATES) {
            let firstImageId = null;

            if (selectedImages.length > 0) {
                firstImageId = selectedImages[0];
            } else if (images.length > 0) {
                firstImageId = images[0].id;
            }

            setProcessingOptions(prev => ({
                ...prev,
                processingMode: newMode,
                templateSelectedImage: firstImageId,
                showTemplates: true
            }));

            if (firstImageId) setSelectedImages([firstImageId]);
        } else {
            // CUSTOM or BATCH_RENAME
            setProcessingOptions(prev => ({
                ...prev,
                processingMode: newMode,
                showTemplates: false,
                templateSelectedImage: null
            }));

            if (newMode === PROCESSING_MODES.BATCH_RENAME) {
                setSelectedImages(images.map(img => img.id));
            }

            // For Custom or Rename, checking if we need to restore multiple selection
            // Logic currently assumes we keep selection as is if not Templates
        }
    };

    const getTranslatedTemplateName = (name, tFunc) => {
        return tFunc(name, { defaultValue: name });
    };

    const handleTemplateToggle = (templateId) => {
        setProcessingOptions(prev => {
            const newSelected = prev.selectedTemplates.includes(templateId)
                ? prev.selectedTemplates.filter(id => id !== templateId)
                : [...prev.selectedTemplates, templateId];

            return { ...prev, selectedTemplates: newSelected };
        });
    };

    const handleSelectAllTemplates = () => {
        const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id);
        setProcessingOptions(prev => ({
            ...prev,
            selectedTemplates: allTemplateIds
        }));
    };

    const handleSelectAllInCategory = (category) => {
        const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
            .filter(template => template.category === category)
            .map(template => template.id);

        setProcessingOptions(prev => ({
            ...prev,
            selectedTemplates: [...new Set([...prev.selectedTemplates, ...categoryTemplates])]
        }));
    };

    const handleDeselectAllInCategory = (category) => {
        const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
            .filter(template => template.category === category)
            .map(template => template.id);

        setProcessingOptions(prev => ({
            ...prev,
            selectedTemplates: prev.selectedTemplates.filter(id => !categoryTemplates.includes(id))
        }));
    };

    const handleOptionChange = (category, key, value) => {
        setProcessingOptions(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value
            }
        }));
    };

    const handleSingleOptionChange = (key, value) => {
        setProcessingOptions(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const processCustomImages = async () => {
        const selectedImagesForProcessing = getSelectedImagesForProcessing(
            images,
            selectedImages,
            processingOptions.processingMode,
            processingOptions.templateSelectedImage
        );

        if (selectedImagesForProcessing.length === 0) {
            showModal(t('message.error'), t('message.errorSelectImages'), MODAL_TYPES.ERROR);
            return;
        }

        setIsLoading(true);
        startProcessingModal(t('message.processingImages', { count: selectedImagesForProcessing.length }));

        try {
            updateProcessingModal(10, t('processing.preparing'));

            const processingConfig = getProcessingConfiguration(processingOptions);

            const validationIssues = validateImageFilesBeforeProcessing(selectedImagesForProcessing);
            if (validationIssues.length > 0 && validationIssues.length === selectedImagesForProcessing.length) {
                const issuesList = validationIssues.map(issue =>
                    `${issue.image}: ${issue.issue}`
                ).join('\n');

                showModal(
                    t('message.error'),
                    `${t('message.errorProcessing')}:\n${issuesList}`,
                    MODAL_TYPES.ERROR
                );
                setIsLoading(false);
                return;
            }


            updateProcessingModal(30, t('processing.processingImages'));

            let processedImages;
            try {
                processedImages = await orchestrateCustomProcessing(
                    selectedImagesForProcessing,
                    processingConfig,
                    aiModelLoaded
                );

                if (!processedImages || processedImages.length === 0) {
                    throw new Error('No images were processed');
                }

                const failedImages = processedImages.filter(img => img.error);
                if (failedImages.length > 0) {
                    const failedNames = failedImages.map(img => img.name).join(', ');
                    setTimeout(() => {
                        showModal(
                            t('message.warning'),
                            `${failedImages.length} image(s) failed to process: ${failedNames}`,
                            MODAL_TYPES.WARNING
                        );
                    }, 2000);
                }

            } catch (processingError) {
                const errorInfo = handleProcessingError(processingError, t);
                throw new Error(`${errorInfo.userMessage}: ${processingError.message}\n\nSuggestion: ${errorInfo.suggestion}`);
            }

            const successfulImages = processedImages.filter(img => !img.error);

            if (successfulImages.length === 0) {
                throw new Error('No images were successfully processed');
            }

            updateProcessingModal(70, t('processing.creatingZip'));

            const settings = generateExportSettings(EXPORT_SETTINGS.CUSTOM, {
                includeOptimized: true,
                includeOriginal: true
            });

            let zipBlob;
            try {
                zipBlob = await createExportZip(
                    selectedImagesForProcessing,
                    successfulImages,
                    settings,
                    processingOptions.processingMode,
                    t
                );

                if (!zipBlob) {
                    throw new Error('Failed to create zip file');
                }
            } catch (zipError) {

                // Failed to create zip
                throw new Error(`Failed to create zip file: ${zipError.message}`);
            }

            updateProcessingModal(90, t('processing.downloading'));

            try {
                downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_CUSTOM);
            } catch {

                setTimeout(() => {
                    showModal(
                        t('message.warning'),
                        'Files were processed but auto-download failed. You can download them manually.',
                        MODAL_TYPES.WARNING
                    );
                }, 3000);
            }

            updateProcessingModal(100, t('processing.complete'));

            const summary = createProcessingSummary({
                imagesProcessed: selectedImagesForProcessing.length,
                totalFiles: successfulImages.length,
                success: true,
                templatesApplied: processingOptions.selectedTemplates.length,
                categoriesApplied: calculateCategoriesApplied(processingOptions.selectedTemplates, SOCIAL_MEDIA_TEMPLATES, false, false),
                errors: processedImages.filter(img => img.error).map(img => ({
                    name: img.name,
                    error: img.error
                })),
                failedCount: processedImages.filter(img => img.error).length
            }, processingConfig, t);

            setTimeout(() => {
                closeModal();
                showSummaryModal(summary);
            }, 1000);

        } catch (error) {
            const errorInfo = handleProcessingError(error, t);

            showModal(
                t('message.error'),
                `${errorInfo.userMessage}\n\n${errorInfo.suggestion}\n\n[Debug] Raw error: ${error.message}`,
                MODAL_TYPES.ERROR
            );

            if (errorInfo.shouldRetry) {
                setTimeout(() => {
                    showModal(
                        t('message.warning'),
                        'Would you like to try processing again with different settings?',
                        MODAL_TYPES.INFO
                    );
                }, 2000);
            }

        } finally {
            setIsLoading(false);

            setTimeout(() => {
                safeCleanupGPUMemory();
            }, 500);
        }
    };

    const processTemplates = async () => {
        const selectedImagesForProcessing = getSelectedImagesForProcessing(
            images,
            selectedImages,
            processingOptions.processingMode,
            processingOptions.templateSelectedImage
        );
        if (selectedImagesForProcessing.length === 0) {
            showModal(t('message.error'), t('message.errorSelectImage'), MODAL_TYPES.ERROR);
            return;
        }

        if ((isFaviconSelected || isScreenshotSelected) && !processingOptions.templateSelectedImage) {
            showModal(t('message.error'), t('message.errorSelectImageForFavicon'), MODAL_TYPES.ERROR);
            return;
        }

        if (isScreenshotSelected && !screenshotUrl.trim()) {
            showModal(t('message.error'), t('message.errorScreenshotUrl'), MODAL_TYPES.ERROR);
            return;
        }

        if (isScreenshotSelected && screenshotUrl.trim()) {
            try {
                let cleanUrl = screenshotUrl.trim();
                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                    cleanUrl = `https://${cleanUrl}`;
                }
                cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');
                new URL(cleanUrl);
                setScreenshotUrl(cleanUrl);
            } catch {
                showModal(t('message.error'), t('message.errorInvalidUrl'), MODAL_TYPES.ERROR);
                return;
            }
        }

        if (processingOptions.selectedTemplates.length === 0 && !isFaviconSelected && !isScreenshotSelected) {
            showModal(t('message.error'), t('message.errorSelectTemplate'), MODAL_TYPES.ERROR);
            return;
        }

        setIsLoading(true);

        const totalTemplatesToProcess = processingOptions.selectedTemplates.length +
            (isFaviconSelected ? 1 : 0) +
            (isScreenshotSelected ? selectedScreenshotTemplates.length : 0);

        startProcessingModal(t('message.processingTemplates', { count: totalTemplatesToProcess }));

        try {
            updateProcessingModal(10, t('processing.preparingTemplates'));

            const processingConfig = getProcessingConfiguration(processingOptions);
            const screenshotTemplateIds = isScreenshotSelected && SCREENSHOT_TEMPLATES ?
                Object.keys(SCREENSHOT_TEMPLATES) : [];

            updateProcessingModal(20, t('processing.setup'));
            const processingOptionsWithExtras = {
                ...processingConfig,
                useServerCapture: false,
                faviconSiteName: processingOptions.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
                faviconThemeColor: processingOptions.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
                faviconBackgroundColor: processingOptions.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR,
                faviconMode: processingOptions.faviconMode || 'basic',
                screenshotUrl: isScreenshotSelected ? screenshotUrl : '',
                includeFavicon: isFaviconSelected,
                includeScreenshots: isScreenshotSelected,
                selectedTemplates: processingOptions.selectedTemplates,
                selectedScreenshotTemplates: screenshotTemplateIds
            };

            const allTemplates = SOCIAL_MEDIA_TEMPLATES;
            const templatesToProcess = isFaviconSelected && processingOptions.selectedTemplates.length === 0 ?
                [] : processingOptions.selectedTemplates;

            updateProcessingModal(30, t('processing.processingTemplates'));
            const processedImages = await orchestrateTemplateProcessing(
                selectedImagesForProcessing[0],
                templatesToProcess,
                allTemplates,
                true,
                aiModelLoaded,
                null,
                processingOptionsWithExtras
            );

            updateProcessingModal(70, t('processing.creatingZip'));
            const settings = generateExportSettings(EXPORT_SETTINGS.TEMPLATES, {
                faviconSiteName: processingOptions.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
                faviconThemeColor: processingOptions.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
                faviconBackgroundColor: processingOptions.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR,
                faviconMode: processingOptions.faviconMode || 'basic',
                screenshotUrl: isScreenshotSelected ? screenshotUrl : '',
                includeFavicon: isFaviconSelected,
                includeScreenshots: isScreenshotSelected,
                selectedScreenshotTemplates: screenshotTemplateIds,
                includeOriginal: false,
                includeOptimized: false,
                includeWebImages: true,
                includeLogoImages: true,
                includeSocialMedia: true,
                createFolders: true
            });

            const zipBlob = await createExportZip(
                [selectedImagesForProcessing[0]],
                processedImages,
                settings,
                PROCESSING_MODES.TEMPLATES,
                t
            );

            updateProcessingModal(90, t('processing.downloading'));
            downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_TEMPLATES);

            updateProcessingModal(100, t('processing.complete'));

            const hasScreenshotPlaceholders = processedImages.some(img =>
                img.template?.category === 'screenshots' &&
                img.method &&
                img.method.includes('placeholder')
            );

            let faviconFilesCountEstimate = 0;
            if (isFaviconSelected) {
                if (processingOptions.faviconMode === 'basic') {
                    faviconFilesCountEstimate = FAVICON_SIZES_BASIC.length + 5;
                } else {
                    faviconFilesCountEstimate = FAVICON_SIZES.length + 5;
                }
            }

            const totalFiles = processedImages.length +
                faviconFilesCountEstimate +
                1;

            const categoriesApplied = calculateCategoriesApplied(
                processingOptions.selectedTemplates,
                SOCIAL_MEDIA_TEMPLATES,
                isFaviconSelected,
                isScreenshotSelected
            );

            const summary = createProcessingSummary({
                imagesProcessed: 1,
                totalFiles: totalFiles,
                success: true,
                templatesApplied: processingOptions.selectedTemplates.length + (isFaviconSelected ? 1 : 0) + (isScreenshotSelected ? selectedScreenshotTemplates.length : 0),
                categoriesApplied: categoriesApplied,
                formatsExported: ['WEBP', 'PNG', 'JPG', 'ICO'],
                screenshotCount: screenshotResults ? screenshotResults.successful : 0
            }, processingConfig, t);

            setTimeout(() => {
                closeModal();
                showSummaryModal(summary);
            }, 1000);

            if (hasScreenshotPlaceholders && isScreenshotSelected) {
                setTimeout(() => {
                    showModal(
                        t('message.info'),
                        t('message.placeholderScreenshotsGenerated'),
                        MODAL_TYPES.INFO
                    );
                }, PROCESSING_DELAYS.MEMORY_CLEANUP);
            }
        } catch (error) {
            const errorInfo = handleProcessingError(error, t);
            showModal(
                t('message.error'),
                `${errorInfo.userMessage}\n\n${errorInfo.suggestion}\n\n[Debug] Raw error: ${error.message}`,
                MODAL_TYPES.ERROR
            );
        } finally {
            setIsLoading(false);
        }
    };

    const incrementValue = (key, increment = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
        const currentValue = parseInt(processingOptions[key] || '0');
        const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue + increment);
        handleSingleOptionChange(key, String(newValue));
    };

    const decrementValue = (key, decrement = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
        const currentValue = parseInt(processingOptions[key] || '1');
        const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue - decrement);
        handleSingleOptionChange(key, String(newValue));
    };

    const downloadScreenshotZip = async (screenshotImages, url) => {
        try {
            if (!screenshotImages || screenshotImages.length === 0) {
                return;
            }

            const zipBlob = await createScreenshotZip(screenshotImages, url, t);
            const timestamp = new Date().toISOString().split('T')[0];
            const domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
            const zipName = `screenshots-${domain}-${timestamp}`;
            downloadZip(zipBlob, zipName);

            showModal(
                t('message.success'),
                t('message.screenshotDownload', { count: screenshotImages.length }),
                MODAL_TYPES.SUCCESS
            );
        } catch {
            showModal(t('message.error'), t('message.errorDownloadScreenshot'), MODAL_TYPES.ERROR);
        }
    };

    const handleCaptureScreenshots = async (url, selectedTemplateIds) => {
        try {
            if (!url || url.trim() === '') {
                throw new Error(t('message.errorScreenshotUrl'));
            }

            if (!selectedTemplateIds || selectedTemplateIds.length === 0) {
                throw new Error(t('templates.selectTemplates'));
            }

            setIsCapturingScreenshots(true);
            setCaptureProgress(10);

            const screenshotTemplates = selectedTemplateIds
                .map(id => SCREENSHOT_TEMPLATES?.[id])
                .filter(template => template);

            if (screenshotTemplates.length === 0) {
                throw new Error(t('message.errorSelectTemplate'));
            }

            setCaptureProgress(30);
            const results = await captureMultipleScreenshots(screenshotTemplates, url);
            setCaptureProgress(80);

            const newImages = convertScreenshotResultsToImages(results);
            setProcessedImages(prev => [...prev, ...newImages]);

            if (newImages.length > 0) {
                await downloadScreenshotZip(newImages, url);
            }

            setCaptureProgress(100);
            return results;
        } finally {
            setIsCapturingScreenshots(false);
            setTimeout(() => setCaptureProgress(0), PROCESSING_DELAYS.MEMORY_CLEANUP);
        }
    };

    const applyRenamePatternToCustom = () => {
        setProcessingOptions(prev => ({
            ...prev,
            processingMode: PROCESSING_MODES.CUSTOM,
            output: {
                ...prev.output,
                rename: true,
                newFileName: prev.batchRename.pattern
            },
            showTemplates: false
        }));
        setSelectedImages(images.map(img => img.id));
    };

    // Derived State
    const selectedImagesForProcessing = getSelectedImagesForProcessing(
        images,
        selectedImages,
        processingOptions.processingMode,
        processingOptions.templateSelectedImage
    );
    const templateCategories = getTemplateCategories();
    const templateSelectedImageObj = images.find(img => img.id === processingOptions.templateSelectedImage);

    const value = {
        isScreenshotMode,
        isFaviconSelected,
        isScreenshotSelected,
        screenshotUrl,
        screenshotResults,
        isCapturingScreenshots,
        captureProgress,
        screenshotValidation,
        selectedScreenshotTemplates,
        processedImages,
        images,
        selectedImages,
        modal,
        isLoading,
        aiModelLoaded,
        aiLoading,
        processingSummary,
        processingOptions,
        fileInputRef,
        showModal,
        closeModal,
        handleModalInteraction,
        showSummaryModal,

        // Setters (we might expose these or wrap them in handlers)
        setIsScreenshotMode,
        setScreenshotUrl,

        // Handlers
        updateProcessingModal,
        startProcessingModal,
        handleScreenshotUrlChange,
        handleImageUpload,
        handleImageSelect,
        handleScreenshotTemplateToggle,
        handleSelectAllScreenshotTemplates,
        handleDeselectAllScreenshotTemplates,
        handleSelectAll,
        handleRemoveSelected,
        handleFaviconToggle,
        handleScreenshotToggle,
        toggleResizeCrop,
        toggleCropMode,
        handleFormatToggle,
        handleSelectAllFormats,
        handleClearAllFormats,
        toggleProcessingMode,
        getTranslatedTemplateName,
        handleTemplateToggle,
        handleSelectAllTemplates,
        handleSelectAllInCategory,
        handleDeselectAllInCategory,
        handleOptionChange,
        handleSingleOptionChange,
        applyRenamePatternToCustom,
        processCustomImages,
        processTemplates,
        incrementValue,
        decrementValue,
        downloadScreenshotZip,
        handleCaptureScreenshots,

        // Derived
        selectedImagesForProcessing,
        templateCategories,
        templateSelectedImageObj,

        // Expose Setters for edge cases
        setProcessingOptions
    };

    return (
        <ProcessingContext.Provider value={value}>
            {children}
        </ProcessingContext.Provider>
    );
};

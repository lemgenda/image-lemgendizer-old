import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getProcessingConfiguration,
  createExportZip,
  createScreenshotZip,
  downloadZip,
  generateExportSettings
} from './processors';
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
  formatFileSize,
  checkImageTransparencyQuick
} from './utils';
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
} from './configs/templateConfigs';
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
} from './constants';
import {
  UploadSection,
  HeaderSection,
  FooterSection,
  ModalElement,
  RangeSliderElement,
  ScreenShotsCard,
  UploadGallerySection,
  TemplateImageSection
} from './components';
import './styles/App.css';

/**
 * Main application component
 * @component
 * @returns {JSX.Element} App component
 */
function App() {
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
    }
  });
  const [userInteractedWithModal, setUserInteractedWithModal] = useState(false);
  const autoCloseTimeoutRef = useRef(null);

  const fileInputRef = useRef(null);

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
      } catch (error) {
      }
    };
    preloadLibraries();
  }, [processingOptions.processingMode, screenshotUrl, t]);

  useEffect(() => {
    const loadAIModelIfNeeded = async () => {
      const needsAI = (processingOptions.cropMode === CROP_MODES.SMART && !aiModelLoaded) ||
        (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && !aiModelLoaded);

      if (!needsAI) return;

      try {
        setAiLoading(true);

        const { loadAIModel } = await import('./utils/memoryUtils');
        const model = await loadAIModel();

        if (model && (model.modelType || typeof model.detect === 'function')) {
          setAiModelLoaded(true);
          setAiLoading(false);
        } else {
          throw new Error('AI model failed to load');
        }
      } catch (error) {
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
  }, [processingOptions.cropMode, processingOptions.processingMode, t]);

  useEffect(() => {
    const blobUrls = [];
    images.forEach(image => {
      if (image.url && image.url.startsWith('blob:')) {
        blobUrls.push(image.url);
      }
    });

    return () => {
      blobUrls.forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
        }
      });
      cleanupBlobUrls(images);
    };
  }, [images]);

  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(image.url);
          } catch (e) {
          }
        }
      });
    };
  }, []);

  /**
   * Updates processing modal progress
   * @param {number} progress - Progress percentage
   * @param {string} step - Progress step description
   * @param {string} title - Modal title
   */
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

  /**
   * Starts processing with initial modal
   * @param {string} message - Initial message
   * @param {number} count - Image count
   */
  const startProcessingModal = (message, count = 1) => {
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

  /**
   * Handles screenshot URL change
   * @param {string} url - New URL
   */
  const handleScreenshotUrlChange = (url) => {
    setScreenshotUrl(url);
    const validation = validateScreenshotUrlInput(url);
    setScreenshotValidation(validation);
  };

  /**
   * Handles image upload
   * @param {FileList} files - Uploaded files
   */
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
              } catch (previewError) {
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

      cleanupBlobUrls(images);

      setImages(prev => [...prev, ...enhancedImages]);

      if (processingOptions.processingMode === PROCESSING_MODES.CUSTOM) {
        if (selectedImages.length === 0) {
          setSelectedImages(enhancedImages.map(img => img.id));
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

      if (enhancedImages.length > 3) {
        setTimeout(() => {
          const galleryElement = document.querySelector('.gallery-card');
          if (galleryElement) {
            galleryElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
          }
        }, 100);
      }

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

  /**
   * Handles image selection
   * @param {string} imageId - Image ID
   */
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

  /**
   * Handles screenshot template toggle
   * @param {string} templateId - Template ID
   */
  const handleScreenshotTemplateToggle = (templateId) => {
    setSelectedScreenshotTemplates(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      } else {
        return [...prev, templateId];
      }
    });
  };

  /**
   * Selects all screenshot templates
   */
  const handleSelectAllScreenshotTemplates = () => {
    const allTemplateIds = Object.keys(SCREENSHOT_TEMPLATES || {});
    setSelectedScreenshotTemplates(allTemplateIds);
  };

  /**
   * Deselects all screenshot templates
   */
  const handleDeselectAllScreenshotTemplates = () => {
    setSelectedScreenshotTemplates([]);
  };

  /**
   * Selects all images
   */
  const handleSelectAll = () => {
    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) return;
    if (selectedImages.length === images.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(images.map(img => img.id));
    }
  };

  /**
   * Removes selected images
   */
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

  /**
   * Handles favicon toggle
   * @param {boolean} selected - Selected state
   */
  const handleFaviconToggle = (selected) => {
    setIsFaviconSelected(selected);
  };

  /**
   * Handles screenshot toggle
   * @param {boolean} selected - Selected state
   */
  const handleScreenshotToggle = (selected) => {
    setIsScreenshotSelected(selected);
    if (!selected) {
      setScreenshotUrl('');
      setScreenshotValidation(null);
      setScreenshotResults(null);
    }
  };

  /**
   * Shows modal
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   * @param {string} type - Modal type
   * @param {boolean} showProgress - Show progress indicator
   * @param {number} progress - Progress percentage
   * @param {string} progressStep - Progress step description
   */
  const showModal = (title, message, type = MODAL_TYPES.INFO, showProgress = false, progress = 0, progressStep = '') => {
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
  };

  /**
   * Shows summary modal
   * @param {Object} summary - Processing summary
   */
  const showSummaryModal = (summary) => {
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
  };

  /**
   * Closes modal
   */
  const closeModal = () => {
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
  };

  /**
   * Handles modal interaction
   */
  const handleModalInteraction = () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
  };

  /**
   * Toggles resize/crop view
   */
  const toggleResizeCrop = () => {
    setProcessingOptions(prev => ({
      ...prev,
      showResize: !prev.showResize,
      showCrop: !prev.showCrop
    }));
  };

  /**
   * Toggles crop mode with proper AI model loading
   */
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

  /**
   * Handles format toggle
   * @param {string} format - Format to toggle
   */
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

  /**
   * Selects all formats
   */
  const handleSelectAllFormats = () => {
    setProcessingOptions(prev => ({
      ...prev,
      output: {
        ...prev.output,
        formats: ALL_OUTPUT_FORMATS.filter(format => format !== IMAGE_FORMATS.ORIGINAL)
      }
    }));
  };

  /**
   * Clears all formats
   */
  const handleClearAllFormats = () => {
    setProcessingOptions(prev => ({
      ...prev,
      output: {
        ...prev.output,
        formats: [IMAGE_FORMATS.ORIGINAL]
      }
    }));
  };

  /**
   * Toggles processing mode
   * @param {string} mode - Processing mode
   */
  const toggleProcessingMode = (mode) => {
    const newMode = mode === PROCESSING_MODES.TEMPLATES ? PROCESSING_MODES.TEMPLATES : PROCESSING_MODES.CUSTOM;

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
      setProcessingOptions(prev => ({
        ...prev,
        processingMode: newMode,
        showTemplates: newMode === PROCESSING_MODES.TEMPLATES,
        templateSelectedImage: null
      }));
    }
  };

  /**
   * Handles template toggle
   * @param {string} templateId - Template ID
   */
  const handleTemplateToggle = (templateId) => {
    setProcessingOptions(prev => {
      const newSelected = prev.selectedTemplates.includes(templateId)
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId];

      return { ...prev, selectedTemplates: newSelected };
    });
  };

  /**
   * Selects all templates
   */
  const handleSelectAllTemplates = () => {
    const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id);
    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: allTemplateIds
    }));
  };

  /**
   * Selects all templates in category
   * @param {string} category - Category ID
   */
  const handleSelectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id);

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: [...new Set([...prev.selectedTemplates, ...categoryTemplates])]
    }));
  };

  /**
   * Deselects all templates in category
   * @param {string} category - Category ID
   */
  const handleDeselectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id);

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.filter(id => !categoryTemplates.includes(id))
    }));
  };

  /**
   * Handles option change
   * @param {string} category - Option category
   * @param {string} key - Option key
   * @param {any} value - New value
   */
  const handleOptionChange = (category, key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  /**
   * Handles single option change
   * @param {string} key - Option key
   * @param {any} value - New value
   */
  const handleSingleOptionChange = (key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Processes custom images
   */
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
          PROCESSING_MODES.CUSTOM,
          processingOptions.output.formats
        );

        if (!zipBlob) {
          throw new Error('Failed to create zip file');
        }
      } catch (zipError) {
        throw new Error(`Failed to create zip file: ${zipError.message}`);
      }

      updateProcessingModal(90, t('processing.downloading'));

      try {
        downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_CUSTOM);
      } catch (downloadError) {
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

  /**
   * Processes templates
   */
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
      } catch (error) {
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
        undefined,
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

  /**
   * Increments value
   * @param {string} key - Value key
   * @param {number} increment - Increment amount
   */
  const incrementValue = (key, increment = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
    const currentValue = parseInt(processingOptions[key] || '0');
    const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue + increment);
    handleSingleOptionChange(key, String(newValue));
  };

  /**
   * Decrements value
   * @param {string} key - Value key
   * @param {number} decrement - Decrement amount
   */
  const decrementValue = (key, decrement = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
    const currentValue = parseInt(processingOptions[key] || '1');
    const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue - decrement);
    handleSingleOptionChange(key, String(newValue));
  };

  /**
   * Downloads screenshot zip
   * @param {Array<Object>} screenshotImages - Screenshot images
   * @param {string} url - URL
   */
  const downloadScreenshotZip = async (screenshotImages, url) => {
    try {
      if (!screenshotImages || screenshotImages.length === 0) {
        return;
      }

      const zipBlob = await createScreenshotZip(screenshotImages, url);
      const timestamp = new Date().toISOString().split('T')[0];
      const domain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      const zipName = `screenshots-${domain}-${timestamp}`;
      downloadZip(zipBlob, zipName);

      showModal(
        t('message.success'),
        t('message.screenshotDownload', { count: screenshotImages.length }),
        MODAL_TYPES.SUCCESS
      );
    } catch (error) {
      showModal(t('message.error'), t('message.errorDownloadScreenshot'), MODAL_TYPES.ERROR);
    }
  };

  /**
   * Handles screenshot capture
   * @param {string} url - URL to capture
   * @param {Array<string>} selectedTemplateIds - Selected template IDs
   * @returns {Promise<Object>} Screenshot results
   */
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
    } catch (error) {
      throw error;
    } finally {
      setIsCapturingScreenshots(false);
      setTimeout(() => setCaptureProgress(0), PROCESSING_DELAYS.MEMORY_CLEANUP);
    }
  };

  const selectedImagesForProcessing = getSelectedImagesForProcessing(
    images,
    selectedImages,
    processingOptions.processingMode,
    processingOptions.templateSelectedImage
  );
  const templateCategories = getTemplateCategories();
  const templateSelectedImageObj = images.find(img => img.id === processingOptions.templateSelectedImage);

  return (
    <div className="app">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            {isScreenshotSelected ? (
              <>
                <i className="fas fa-camera fa-spin fa-3x"></i>
                <p>{t('loading.capturingScreenshots')}</p>
                <p className="text-muted text-sm mt-2">
                  {t('loading.screenshotProcess')}
                </p>
              </>
            ) : (
              <>
                <i className="fas fa-spinner fa-spin fa-3x"></i>
                <p>{t('loading.preparing')}</p>
                <p className="text-muted text-sm mt-2">
                  {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && aiModelLoaded
                    ? t('loading.aiCropping')
                    : t('loading.upscalingWhenNeeded')}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {aiLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-brain fa-spin fa-3x"></i>
            <p>{t('loading.aiModel')}</p>
            <p className="text-muted">{t('loading.oncePerSession')}</p>
            <p className="text-sm mt-2">
              {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES
                ? t('loading.aiForTemplates')
                : t('loading.aiForSmartCrop')}
            </p>
          </div>
        </div>
      )}

      <HeaderSection />

      <main className="main-content">
        <UploadSection
          onUpload={handleImageUpload}
          fileInputRef={fileInputRef}
        />

        {images.length > 0 && (
          <>
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <i className="fas fa-sliders-h"></i> {t('mode.title')}
                </h2>
                <div className="card-actions">
                  <button
                    className={`btn ${processingOptions.processingMode === PROCESSING_MODES.CUSTOM ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('custom')}
                  >
                    <i className="fas fa-sliders-h"></i> {t('mode.custom')}
                  </button>
                  <button
                    className={`btn ${processingOptions.processingMode === PROCESSING_MODES.TEMPLATES ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('templates')}
                  >
                    <i className="fas fa-th-large"></i> {t('mode.templates')}
                  </button>
                </div>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES
                  ? t('mode.templatesInfo')
                  : t('mode.customInfo')
                }
              </div>

              {processingOptions.processingMode === PROCESSING_MODES.CUSTOM ? (
                <>
                  <div className="grid grid-cols-auto gap-lg mb-lg">
                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-compress"></i> {t('compression.title')}
                      </h3>
                      <div className="form-group">
                        <div className="range-wrapper">
                          <RangeSliderElement
                            label={t('compression.quality')}
                            min={COMPRESSION_QUALITY_RANGE.MIN}
                            max={COMPRESSION_QUALITY_RANGE.MAX}
                            value={processingOptions.compression.quality}
                            onChange={(val) =>
                              handleOptionChange('compression', 'quality', val)
                            }
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('compression.targetSize')}</label>
                        <div className="number-input-wrapper">
                          <input
                            type="number"
                            className="input-field"
                            value={processingOptions.compression.fileSize}
                            onChange={(e) => handleOptionChange('compression', 'fileSize', e.target.value)}
                            placeholder={t('compression.auto')}
                            min={NUMBER_INPUT_CONSTANTS.MIN_VALUE}
                          />
                          <div className="number-input-spinner">
                            <button
                              type="button"
                              className="number-input-button"
                              onClick={() => handleOptionChange('compression', 'fileSize', String(parseInt(processingOptions.compression.fileSize || 0) + NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT))}
                            >
                              <i className="fas fa-chevron-up"></i>
                            </button>
                            <button
                              type="button"
                              className="number-input-button"
                              onClick={() => handleOptionChange('compression', 'fileSize', String(Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, parseInt(processingOptions.compression.fileSize || 10) - NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT)))}>
                              <i className="fas fa-chevron-down"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-file-export"></i> {t('output.title')}
                      </h3>

                      <div className="form-group">
                        <label className="form-label">{t('output.format')}</label>
                        <div className="space-y-sm mb-md">
                          <div className="grid grid-cols-2 gap-sm">
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes(IMAGE_FORMATS.WEBP)}
                                onChange={() => handleFormatToggle(IMAGE_FORMATS.WEBP)}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">
                                {t('output.format.webp')}
                              </span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes(IMAGE_FORMATS.AVIF)}
                                onChange={() => handleFormatToggle(IMAGE_FORMATS.AVIF)}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">
                                {t('output.format.avif')}
                              </span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes(IMAGE_FORMATS.JPG)}
                                onChange={() => handleFormatToggle(IMAGE_FORMATS.JPG)}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.jpg')}</span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes(IMAGE_FORMATS.PNG)}
                                onChange={() => handleFormatToggle(IMAGE_FORMATS.PNG)}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.png')}</span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes(IMAGE_FORMATS.ORIGINAL)}
                                onChange={() => handleFormatToggle(IMAGE_FORMATS.ORIGINAL)}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.original')}</span>
                            </label>
                          </div>

                          <div className="flex flex-col gap-xs mt-sm">
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={handleSelectAllFormats}
                            >
                              <i className="fas fa-check-square"></i> {t('output.selectAll')}
                            </button>
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={handleClearAllFormats}
                            >
                              <i className="fas fa-times-circle"></i> {t('output.clearAll')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={processingOptions.output.rename}
                            onChange={(e) => handleOptionChange('output', 'rename', e.target.checked)}
                          />
                          <span className="checkbox-custom"></span>
                          <span>{t('output.rename')}</span>
                        </label>
                      </div>
                      {processingOptions.output.rename && (
                        <div className="form-group">
                          <label className="form-label">{t('output.newFileName')}</label>
                          <input
                            type="text"
                            className="input-field"
                            value={processingOptions.output.newFileName}
                            onChange={(e) => handleOptionChange('output', 'newFileName', e.target.value)}
                            placeholder={t('output.newFileName.placeholder')}
                          />
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="card-title">
                        {processingOptions.showResize ? (
                          <>
                            <i className="fas fa-expand-alt"></i> {t('resize.title')}
                          </>
                        ) : (
                          <>
                            <i className="fas fa-crop-alt"></i> {processingOptions.cropMode === CROP_MODES.SMART ? t('crop.switchToStandard') : t('crop.switchToSmart')}
                          </>
                        )}
                      </h3>
                      <div className="mb-md">
                        <button
                          className="btn btn-secondary btn-full-width"
                          onClick={toggleResizeCrop}
                        >
                          {processingOptions.showResize ? (
                            <>
                              <i className="fas fa-crop"></i> {t('resize.switchToCrop')}
                            </>
                          ) : (
                            <>
                              <i className="fas fa-expand-alt"></i> {t('resize.switchToResize')}
                            </>
                          )}
                        </button>
                      </div>

                      {processingOptions.showResize ? (
                        <div className="form-group">
                          <label className="form-label">{t('resize.dimension')}</label>
                          <div className="number-input-wrapper">
                            <input
                              type="number"
                              className="input-field"
                              value={processingOptions.resizeDimension}
                              onChange={(e) => handleSingleOptionChange('resizeDimension', e.target.value)}
                              placeholder={`e.g., ${RESIZE_DIMENSION_RANGE.DEFAULT}`}
                              min={RESIZE_DIMENSION_RANGE.MIN}
                              max={RESIZE_DIMENSION_RANGE.MAX}
                            />
                            <div className="number-input-spinner">
                              <button
                                type="button"
                                className="number-input-button"
                                onClick={() => incrementValue('resizeDimension', NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT)}
                              >
                                <i className="fas fa-chevron-up"></i>
                              </button>
                              <button
                                type="button"
                                className="number-input-button"
                                onClick={() => decrementValue('resizeDimension', NUMBER_INPUT_CONSTANTS.LARGE_INCREMENT)}
                              >
                                <i className="fas fa-chevron-down"></i>
                              </button>
                            </div>
                          </div>
                          <p className="form-helper">
                            {t('resize.helper')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-md">
                          <div className="form-group">
                            <div className="toggle-btn">
                              <button
                                type="button"
                                className={`btn ${processingOptions.cropMode === CROP_MODES.SMART ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={toggleCropMode}
                                disabled={aiLoading}
                              >
                                {processingOptions.cropMode === CROP_MODES.SMART ? (
                                  <>
                                    <i className="fas fa-crop-alt"></i> {t('crop.switchToStandard')}
                                    {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-brain"></i> {t('crop.switchToSmart')}
                                    {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                  </>
                                )}
                              </button>
                            </div>
                            {processingOptions.cropMode === CROP_MODES.SMART && (
                              <p className="text-sm text-muted mt-sm">
                                <i className="fas fa-info-circle mr-1"></i>
                                {t('crop.smartBest')}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-md">
                            <div className="form-group">
                              <label className="form-label">{t('crop.width')}</label>
                              <div className="number-input-wrapper">
                                <input
                                  type="number"
                                  className="input-field"
                                  value={processingOptions.cropWidth}
                                  onChange={(e) => handleSingleOptionChange('cropWidth', e.target.value)}
                                  placeholder={`Width (${CROP_DIMENSION_RANGE.DEFAULT_WIDTH})`}
                                  min={CROP_DIMENSION_RANGE.MIN}
                                  max={CROP_DIMENSION_RANGE.MAX}
                                  disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                />
                                <div className="number-input-spinner">
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => incrementValue('cropWidth')}
                                    disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                  >
                                    <i className="fas fa-chevron-up"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => decrementValue('cropWidth')}
                                    disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                  >
                                    <i className="fas fa-chevron-down"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="form-label">{t('crop.height')}</label>
                              <div className="number-input-wrapper">
                                <input
                                  type="number"
                                  className="input-field"
                                  value={processingOptions.cropHeight}
                                  onChange={(e) => handleSingleOptionChange('cropHeight', e.target.value)}
                                  placeholder={`Height (${CROP_DIMENSION_RANGE.DEFAULT_HEIGHT})`}
                                  min={CROP_DIMENSION_RANGE.MIN}
                                  max={CROP_DIMENSION_RANGE.MAX}
                                  disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                />
                                <div className="number-input-spinner">
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => incrementValue('cropHeight')}
                                    disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                  >
                                    <i className="fas fa-chevron-up"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => decrementValue('cropHeight')}
                                    disabled={aiLoading && processingOptions.cropMode === CROP_MODES.SMART}
                                  >
                                    <i className="fas fa-chevron-down"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {processingOptions.cropMode === CROP_MODES.STANDARD && (
                            <div className="form-group">
                              <label className="form-label">{t('crop.position')}</label>
                              <select
                                value={processingOptions.cropPosition}
                                onChange={(e) => handleSingleOptionChange('cropPosition', e.target.value)}
                                className="select-field"
                              >
                                {CROP_POSITION_LIST.map(position => (
                                  <option key={position} value={position}>
                                    {t(`crop.position.${position}`)}
                                  </option>
                                ))}
                              </select>
                              <p className="form-helper">
                                {t('crop.helper')}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      className="btn btn-primary btn-lg"
                      disabled={selectedImagesForProcessing.length === 0 || isLoading || (processingOptions.cropMode === CROP_MODES.SMART && aiLoading) || !processingOptions.output.formats || processingOptions.output.formats.length === 0}
                      onClick={processCustomImages}
                    >
                      {isLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> {t('button.processing')}
                        </>
                      ) : processingOptions.cropMode === CROP_MODES.SMART && aiLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> {t('button.loadingAI')}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-download"></i> {t('button.process')}
                          <span className="ml-1">
                            ({t('button.imageCount', { count: selectedImagesForProcessing.length })} × {t('button.formatCount', { count: processingOptions.output.formats.length })})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <h3 className="card-title">
                          <i className="fas fa-th-large"></i> {t('templates.title')}
                        </h3>
                        <p className="text-muted mt-xs">
                          <i className="fas fa-info-circle"></i>
                          {t('templates.note')}
                        </p>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleSelectAllTemplates}
                          disabled={!processingOptions.templateSelectedImage}
                        >
                          <i className="fas fa-check-square"></i> {t('templates.selectAll')}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setProcessingOptions(prev => ({ ...prev, selectedTemplates: [] }))}
                          disabled={processingOptions.selectedTemplates.length === 0}
                        >
                          <i className="fas fa-times-circle"></i> {t('templates.clearAll')}
                        </button>
                      </div>
                    </div>

                    <div className="templates-grid mb-lg">
                      {templateCategories.map((category) => {
                        const categoryTemplates = SOCIAL_MEDIA_TEMPLATES.filter(template =>
                          template.category === category.id
                        );

                        return (
                          <div key={category.id} className="card">
                            <div className="card-header">
                              <h4 className="card-title">
                                <i className={`${category.icon} mr-sm`}></i> {t(`category.${category.id}`)}
                              </h4>
                              {category.id !== 'screenshots' && (
                                <div className="card-actions">
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleSelectAllInCategory(category.id)}
                                    disabled={!processingOptions.templateSelectedImage}
                                  >
                                    <i className="fas fa-check"></i> {t('templates.selectCategory')}
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDeselectAllInCategory(category.id)}
                                    disabled={!processingOptions.templateSelectedImage}
                                  >
                                    <i className="fas fa-times"></i> {t('templates.deselectCategory')}
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="space-y-sm">
                              {categoryTemplates.map(template => (
                                <label key={template.id} className="checkbox-wrapper">
                                  <input
                                    type="checkbox"
                                    className="checkbox-input"
                                    checked={processingOptions.selectedTemplates.includes(template.id)}
                                    onChange={() => handleTemplateToggle(template.id)}
                                    disabled={!processingOptions.templateSelectedImage}
                                  />
                                  <span className="checkbox-custom"></span>
                                  <span className="flex-1">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">{getTranslatedTemplateName(template.name, t)}</span>
                                      <span className="text-muted text-sm">
                                        {template.width}×{template.height === 'auto' ? 'auto' : template.height}
                                      </span>
                                    </div>
                                  </span>
                                </label>
                              ))}

                              {category.id === 'screenshots' && (
                                <div className="screenshot-section">
                                  <ScreenShotsCard
                                    isSelected={isScreenshotSelected}
                                    onToggle={handleScreenshotToggle}
                                    screenshotUrl={screenshotUrl}
                                    onUrlChange={handleScreenshotUrlChange}
                                    validation={screenshotValidation}
                                    isCapturing={isCapturingScreenshots}
                                    captureProgress={captureProgress}
                                    onCaptureClick={handleCaptureScreenshots}
                                    selectedTemplates={selectedScreenshotTemplates}
                                    onTemplateToggle={handleScreenshotTemplateToggle}
                                    onSelectAllTemplates={handleSelectAllScreenshotTemplates}
                                    onDeselectAllTemplates={handleDeselectAllScreenshotTemplates}
                                    showTemplateActions={false}
                                  />
                                </div>
                              )}

                              {category.id === 'favicon' && (
                                <div className="flex flex-col">
                                  <div className="checkbox-wrapper" onClick={() => handleFaviconToggle(!isFaviconSelected)}>
                                    <input
                                      type="checkbox"
                                      className="checkbox-input"
                                      checked={isFaviconSelected}
                                      onChange={(e) => handleFaviconToggle(e.target.checked)}
                                      disabled={!processingOptions.templateSelectedImage}
                                    />
                                    <span className="checkbox-custom"></span>
                                    <span className="flex-1">
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium">Favicon Set</span>
                                        <span className="text-muted text-sm">Multiple sizes</span>
                                      </div>
                                    </span>
                                  </div>

                                  {isFaviconSelected && (
                                    <div className="mt-2 pl-8 space-y-2">
                                      <div className="checkbox-wrapper" onClick={(e) => { e.stopPropagation(); handleSingleOptionChange('faviconMode', 'basic'); }}>
                                        <input
                                          type="radio"
                                          name="faviconMode"
                                          className="checkbox-input"
                                          checked={processingOptions.faviconMode === 'basic'}
                                          onChange={() => { }}
                                        />
                                        <span className="checkbox-custom"></span>
                                        <span className="flex-1 text-sm">Basic Set (Essential Only)</span>
                                      </div>

                                      <div className="checkbox-wrapper" onClick={(e) => { e.stopPropagation(); handleSingleOptionChange('faviconMode', 'complete'); }}>
                                        <input
                                          type="radio"
                                          name="faviconMode"
                                          className="checkbox-input"
                                          checked={processingOptions.faviconMode !== 'basic'}
                                          onChange={() => { }}
                                        />
                                        <span className="checkbox-custom"></span>
                                        <span className="flex-1 text-sm">Complete Set (All Platforms)</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <TemplateImageSection
                      templateSelectedImageObj={templateSelectedImageObj}
                      processingOptions={processingOptions}
                      isFaviconSelected={isFaviconSelected}
                      isScreenshotSelected={isScreenshotSelected}
                      selectedScreenshotTemplates={selectedScreenshotTemplates}
                      isLoading={isLoading}
                      onProcessTemplates={processTemplates}
                      formatFileSize={formatFileSize}
                      t={t}
                    />
                  </div>
                </>
              )}
            </div>

            <UploadGallerySection
              images={images}
              selectedImages={selectedImages}
              processingMode={processingOptions.processingMode}
              templateSelectedImage={processingOptions.templateSelectedImage}
              onImageSelect={handleImageSelect}
              onSelectAll={handleSelectAll}
              onRemoveSelected={handleRemoveSelected}
              formatFileSize={formatFileSize}
            />
          </>
        )}
      </main>

      <FooterSection />

      <ModalElement
        isOpen={modal.isOpen && modal.type !== MODAL_TYPES.SUMMARY}
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
        onInteraction={handleModalInteraction}
        showProgress={modal.showProgress}
        progress={modal.progress}
        progressStep={modal.progressStep}
      >
        <p>{modal.message}</p>
        {modal.showProgress && modal.progress < 100 && (
          <div className="mt-3">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${modal.progress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              <span>{modal.progressStep}</span>
              <span>{modal.progress}%</span>
            </div>
          </div>
        )}
      </ModalElement>

      <ModalElement
        isOpen={modal.isOpen && modal.type === MODAL_TYPES.SUMMARY}
        onClose={closeModal}
        title={modal.title}
        type={MODAL_TYPES.SUMMARY}
        onInteraction={handleModalInteraction}
        actions={
          <button
            className="btn btn-primary"
            onClick={closeModal}
            onMouseDown={handleModalInteraction}
          >
            {t('button.ok')}
          </button>
        }
      >
        {processingSummary && (
          <div className="summary-content">
            <div className="summary-section">
              <h4 className="summary-title">
                <i className="fas fa-check-circle text-success mr-2"></i>
                {t('summary.processingComplete')}
              </h4>

              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-label">{t('summary.mode')}:</div>
                  <div className="summary-value capitalize">{processingSummary.mode}</div>
                </div>

                {processingSummary.mode === 'templates' && processingSummary.templatesApplied > 0 && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.templatesApplied')}:</div>
                    <div className="summary-value">
                      {processingSummary.templatesApplied}
                    </div>
                  </div>
                )}

                {processingSummary.mode === 'templates' && processingSummary.categoriesApplied > 0 && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.categoriesApplied')}:</div>
                    <div className="summary-value">{processingSummary.categoriesApplied}</div>
                  </div>
                )}

                {processingSummary.screenshotCount > 0 && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.screenshotCount')}:</div>
                    <div className="summary-value text-success">
                      <i className="fas fa-camera mr-1"></i>
                      {processingSummary.screenshotCount}
                    </div>
                  </div>
                )}

                {processingSummary.mode === 'templates' && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.formatsExported')}:</div>
                    <div className="summary-value">
                      {processingSummary.formatsExported && processingSummary.formatsExported.length > 0
                        ? processingSummary.formatsExported.map(format => (
                          <span key={format} className="format-badge">
                            {format.toUpperCase()}
                          </span>
                        ))
                        : 'WEBP, PNG, JPG, ICO'}
                    </div>
                  </div>
                )}

                <div className="summary-item">
                  <div className="summary-label">{t('summary.totalFiles')}:</div>
                  <div className="summary-value">
                    {processingSummary.totalFiles}
                  </div>
                </div>

                <div className="summary-item">
                  <div className="summary-label">{t('summary.aiUsed')}:</div>
                  <div className="summary-value">
                    {processingSummary.aiUsed ? (
                      <span className="text-success">
                        <i className="fas fa-brain mr-1"></i> {t('summary.yes')}
                      </span>
                    ) : (
                      <span className="text-muted">{t('summary.no')}</span>
                    )}
                  </div>
                </div>

                {processingSummary.upscalingUsed && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.upscalingUsed')}:</div>
                    <div className="summary-value text-success">
                      <i className="fas fa-expand-arrows-alt mr-1"></i> {t('summary.yes')}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {processingSummary.operations && processingSummary.operations.length > 0 && (
              <div className="summary-section">
                <h5 className="summary-subtitle">
                  <i className="fas fa-tasks mr-2"></i>
                  {t('summary.operationsPerformed')}:
                </h5>
                <ul className="summary-list">
                  {processingSummary.operations.map((op, index) => (
                    <li key={index} className="summary-list-item">
                      <i className="fas fa-check text-success mr-2"></i>
                      {op}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </ModalElement>
    </div>
  );
}

export default App;
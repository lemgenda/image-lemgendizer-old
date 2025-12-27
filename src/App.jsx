import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  orchestrateCustomProcessing,
  orchestrateTemplateProcessing,
  createImageObjects,
  loadAIModel,
  getProcessingConfiguration,
  createProcessingSummary,
  cleanupBlobUrls,
  createExportZip,
  downloadZip,
  generateExportSettings,
  loadUTIFLibrary
} from './processors';

import {
  validateProcessingOptions,
  calculateTotalTemplateFiles,
  formatFileSize,
  captureScreenshot,
  captureScreenshotsForTemplates
} from './utils';

import {
  getTemplateCategories,
  SOCIAL_MEDIA_TEMPLATES,
  SCREENSHOT_TEMPLATES,
  DEFAULT_FAVICON_BACKGROUND_COLOR,
  DEFAULT_FAVICON_SITE_NAME,
  SCREENSHOT_TEMPLATE_ID,
  FAVICON_TEMPLATE_ID,
  DEFAULT_FAVICON_THEME_COLOR
} from './configs/templateConfigs';

import {
  PROCESSING_MODES,
  COMPRESSION_QUALITY_RANGE,
  CROP_MODES,
  ALL_OUTPUT_FORMATS,
  DEFAULT_PROCESSING_CONFIG,
  MODAL_TYPES,
  EXPORT_SETTINGS,
  URL_CONSTANTS,
  NUMBER_INPUT_CONSTANTS,
  IMAGE_FORMATS,
  CROP_POSITIONS,
  RESIZE_DIMENSION_RANGE,
  CROP_DIMENSION_RANGE
} from './constants/sharedConstants';

import {
  ImageUploader,
  Header,
  Footer,
  Modal,
  RangeSlider,
  SiteScreenshots
} from './components';

import './styles/App.css';

function App() {
  const { t, i18n } = useTranslation();
  const [isFaviconSelected, setIsFaviconSelected] = useState(false);
  const [isScreenshotSelected, setIsScreenshotSelected] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotValidation, setScreenshotValidation] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: MODAL_TYPES.INFO
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

  const fileInputRef = useRef(null);

  useEffect(() => {
    const preloadLibraries = async () => {
      try {
        await loadUTIFLibrary();
      } catch { }
    };

    preloadLibraries();
  }, [processingOptions.processingMode, screenshotUrl, t]);

  useEffect(() => {
    const loadAIModelAsync = async () => {
      const needsAI = (processingOptions.cropMode === CROP_MODES.SMART && !aiModelLoaded) ||
        (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && !aiModelLoaded);

      if (needsAI) {
        try {
          setAiLoading(true);
          await loadAIModel();
          setAiModelLoaded(true);
          setAiLoading(false);
        } catch (error) {
          setAiLoading(false);
          showModal(t('message.error'), t('message.aiFailed'), MODAL_TYPES.ERROR);

          if (processingOptions.cropMode === CROP_MODES.SMART) {
            setProcessingOptions(prev => ({ ...prev, cropMode: CROP_MODES.STANDARD }));
          }
        }
      }
    };
    loadAIModelAsync();
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
        } catch { }
      });

      cleanupBlobUrls(images);
    };
  }, [images]);

  /**
   * Handles image upload
   */
  const handleImageUpload = async (files) => {
    try {
      setIsLoading(true);
      const newImages = await createImageObjects(files);

      setImages(prev => {
        cleanupBlobUrls(prev);
        return [...prev, ...newImages];
      });

      if (processingOptions.processingMode === PROCESSING_MODES.CUSTOM) {
        if (selectedImages.length === 0) {
          setSelectedImages(newImages.map(img => img.id));
        } else {
          setSelectedImages(prev => [...prev, ...newImages.map(img => img.id)]);
        }
      }

      if ((processingOptions.processingMode === PROCESSING_MODES.TEMPLATES || processingOptions.showTemplates) &&
        !processingOptions.templateSelectedImage &&
        newImages.length > 0) {
        setProcessingOptions(prev => ({
          ...prev,
          templateSelectedImage: newImages[0].id
        }));
      }

      showModal(t('message.success'), t('message.successUpload', { count: files.length }), MODAL_TYPES.SUCCESS);

    } catch {
      showModal(t('message.error'), t('message.errorUpload'), MODAL_TYPES.ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles image selection
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
   * Handles select all images
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
   * Handles removing selected images
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
   */
  const handleFaviconToggle = (selected) => {
    setIsFaviconSelected(selected);

    if (selected) {
      if (!processingOptions.selectedTemplates.includes(FAVICON_TEMPLATE_ID)) {
        setProcessingOptions(prev => ({
          ...prev,
          selectedTemplates: [...prev.selectedTemplates, FAVICON_TEMPLATE_ID],
          includeFavicon: true
        }));
      }
    } else {
      setProcessingOptions(prev => ({
        ...prev,
        selectedTemplates: prev.selectedTemplates.filter(id => id !== FAVICON_TEMPLATE_ID),
        includeFavicon: false
      }));
    }
  };

  /**
   * Handles screenshot toggle
   */
  const handleScreenshotToggle = (selected) => {
    setIsScreenshotSelected(selected);

    if (selected) {
      setProcessingOptions(prev => ({
        ...prev,
        selectedTemplates: prev.selectedTemplates.filter(id => id !== SCREENSHOT_TEMPLATE_ID)
      }));
    } else {
      setProcessingOptions(prev => ({
        ...prev,
        selectedTemplates: prev.selectedTemplates.filter(id => id !== SCREENSHOT_TEMPLATE_ID)
      }));
      setScreenshotUrl('');
      setScreenshotValidation(null);
    }
  };

  /**
   * Handles screenshot URL change
   */
  const handleScreenshotUrlChange = (url) => {
    setScreenshotUrl(url);

    if (url.trim()) {
      try {
        // Clean the URL first
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = `https://${cleanUrl}`;
        }
        cleanUrl = cleanUrl.replace(/(https?:\/\/)\/+/g, '$1');

        // Validate URL
        new URL(cleanUrl);

        // Test if it's a valid website URL
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

        if (urlPattern.test(cleanUrl)) {
          setScreenshotValidation({
            isValid: true,
            message: 'Valid website URL - ready for screenshots'
          });
        } else {
          setScreenshotValidation({
            isValid: false,
            message: 'Please enter a valid website URL'
          });
        }
      } catch {
        setScreenshotValidation({
          isValid: false,
          message: 'Invalid URL format'
        });
      }
    } else {
      setScreenshotValidation(null);
    }
  };

  /**
   * Shows modal
   */
  const showModal = (title, message, type = MODAL_TYPES.INFO) => {
    setModal({ isOpen: true, title, message, type });
  };

  /**
   * Shows summary modal
   */
  const showSummaryModal = (summary) => {
    setProcessingSummary(summary);
    setModal({
      isOpen: true,
      title: t('summary.title'),
      message: '',
      type: MODAL_TYPES.SUMMARY
    });
  };

  /**
   * Closes modal
   */
  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: MODAL_TYPES.INFO });
    setProcessingSummary(null);
  };

  /**
   * Toggles resize/crop
   */
  const toggleResizeCrop = () => {
    setProcessingOptions(prev => ({
      ...prev,
      showResize: !prev.showResize,
      showCrop: !prev.showCrop
    }));
  };

  /**
   * Toggles crop mode
   */
  const toggleCropMode = () => {
    setProcessingOptions(prev => ({
      ...prev,
      cropMode: prev.cropMode === CROP_MODES.SMART ? CROP_MODES.STANDARD : CROP_MODES.SMART
    }));
  };

  /**
   * Handles format toggle
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
   * Handles select all formats
   */
  const handleSelectAllFormats = () => {
    setProcessingOptions(prev => ({
      ...prev,
      output: {
        ...prev.output,
        formats: ALL_OUTPUT_FORMATS
      }
    }));
  };

  /**
   * Handles clear all formats
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
   * Handles select all templates
   */
  const handleSelectAllTemplates = () => {
    const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id);
    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: allTemplateIds
    }));
  };

  /**
   * Handles select all in category
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
   * Handles deselect all in category
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
   */
  const handleSingleOptionChange = (key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Gets selected images for processing
   */
  const getSelectedImagesForProcessing = () => {
    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
      return processingOptions.templateSelectedImage
        ? images.filter(img => img.id === processingOptions.templateSelectedImage)
        : [];
    } else {
      return images.filter(img => selectedImages.includes(img.id));
    }
  };

  /**
   * Processes custom images
   */
  const processCustomImages = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing();
    if (selectedImagesForProcessing.length === 0) {
      showModal(t('message.error'), t('message.errorSelectImages'), MODAL_TYPES.ERROR);
      return;
    }

    const validation = validateProcessingOptions(processingOptions);
    if (!validation.isValid) {
      showModal(t('message.error'), validation.errors.join('\n'), MODAL_TYPES.ERROR);
      return;
    }

    setIsLoading(true);
    showModal(t('message.processingImages', { count: selectedImagesForProcessing.length }), t('message.processingImages', { count: selectedImagesForProcessing.length }), MODAL_TYPES.INFO);

    try {
      const processingConfig = getProcessingConfiguration(processingOptions);
      const processedImages = await orchestrateCustomProcessing(
        selectedImagesForProcessing,
        processingConfig,
        aiModelLoaded,
      );

      const settings = generateExportSettings(EXPORT_SETTINGS.CUSTOM);
      const zipBlob = await createExportZip(
        selectedImagesForProcessing,
        processedImages,
        settings,
        PROCESSING_MODES.CUSTOM,
        processingOptions.output.formats
      );

      downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_CUSTOM);

      const summary = createProcessingSummary({
        imagesProcessed: selectedImagesForProcessing.length,
        totalFiles: processedImages.length,
        success: true,
        templatesApplied: processingOptions.selectedTemplates.length,
        categoriesApplied: calculateCategoriesApplied(processingOptions.selectedTemplates, SOCIAL_MEDIA_TEMPLATES)
      }, processingConfig, t);

      closeModal();
      showSummaryModal(summary);

    } catch {
      showModal(t('message.error'), t('message.errorProcessing'), MODAL_TYPES.ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Processes templates
   */
  const processTemplates = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing();
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

    const hasScreenshotTemplates = processingOptions.selectedTemplates.some(id => {
      const template = SOCIAL_MEDIA_TEMPLATES.find(t => t.id === id);
      return template && template.category === 'screenshots';
    });

    if (hasScreenshotTemplates && isScreenshotSelected) {
      showModal(
        t('message.processingImages', { count: processingOptions.selectedTemplates.length }),
        t('message.generatingScreenshots'),
        MODAL_TYPES.INFO
      );
    } else {
      showModal(
        t('message.processingImages', { count: processingOptions.selectedTemplates.length }),
        t('message.processingImages', { count: processingOptions.selectedTemplates.length }),
        MODAL_TYPES.INFO
      );
    }

    try {
      const processingConfig = getProcessingConfiguration(processingOptions);

      // FIXED: Use SCREENSHOT_TEMPLATES from config
      const screenshotTemplateIds = isScreenshotSelected && SCREENSHOT_TEMPLATES ?
        Object.keys(SCREENSHOT_TEMPLATES) : [];

      const processingOptionsWithExtras = {
        ...processingConfig,
        useServerCapture: false, // Disable server capture, use your working API
        faviconSiteName: processingOptions.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
        faviconThemeColor: processingOptions.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
        faviconBackgroundColor: processingOptions.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR,
        screenshotUrl: isScreenshotSelected ? screenshotUrl : '',
        includeFavicon: isFaviconSelected,
        includeScreenshots: isScreenshotSelected,
        selectedTemplates: processingOptions.selectedTemplates,
        selectedScreenshotTemplates: screenshotTemplateIds,
        ...(isFaviconSelected && { faviconTemplateIds: [FAVICON_TEMPLATE_ID] })
      };

      // FIXED: Use orchestrateTemplateProcessing with updated screenshot handling
      const processedImages = await orchestrateTemplateProcessing(
        selectedImagesForProcessing[0],
        processingOptions.selectedTemplates,
        SOCIAL_MEDIA_TEMPLATES,
        true,
        aiModelLoaded,
        null,
        processingOptionsWithExtras
      );

      // FIXED: Handle screenshot results separately if needed
      let screenshotResults = [];
      if (isScreenshotSelected && screenshotUrl.trim()) {
        try {
          // Capture screenshots using the working API
          screenshotResults = await captureScreenshotsForTemplates(
            screenshotUrl,
            screenshotTemplateIds,
            { timeout: 30000 }
          );

          // Add screenshot results to processed images
          screenshotResults.forEach(result => {
            if (result.success) {
              processedImages.push({
                ...result,
                template: SCREENSHOT_TEMPLATES[result.templateId],
                category: 'screenshots',
                processed: true
              });
            }
          });
        } catch (screenshotError) {
          console.warn('Screenshot capture failed:', screenshotError);
          // Continue with template processing even if screenshots fail
        }
      }

      const settings = generateExportSettings(EXPORT_SETTINGS.TEMPLATES, {
        faviconSiteName: processingOptions.faviconSiteName || DEFAULT_FAVICON_SITE_NAME,
        faviconThemeColor: processingOptions.faviconThemeColor || DEFAULT_FAVICON_THEME_COLOR,
        faviconBackgroundColor: processingOptions.faviconBackgroundColor || DEFAULT_FAVICON_BACKGROUND_COLOR,
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
        PROCESSING_MODES.TEMPLATES
      );

      downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_TEMPLATES);

      const hasScreenshotPlaceholders = processedImages.some(img =>
        img.template?.category === 'screenshots' &&
        img.method &&
        img.method.includes('placeholder')
      );

      const summary = createProcessingSummary({
        imagesProcessed: 1,
        totalFiles: processedImages.length,
        success: true,
        usedPlaceholders: hasScreenshotPlaceholders,
        screenshotCount: screenshotResults.filter(r => r.success).length
      }, processingConfig, t);

      closeModal();
      showSummaryModal(summary);

      if (hasScreenshotPlaceholders && isScreenshotSelected) {
        setTimeout(() => {
          showModal(
            t('message.info'),
            t('message.placeholderScreenshotsGenerated'),
            MODAL_TYPES.INFO
          );
        }, 1000);
      }

    } catch (error) {
      console.error('Template processing error:', error);
      showModal(t('message.error'), `${t('message.errorApplying')}: ${error.message}`, MODAL_TYPES.ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formats template name
   */
  const formatTemplateName = (name) => {
    return t(`template.${name}`) || name;
  };

  /**
   * Increments value
   */
  const incrementValue = (key, increment = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
    const currentValue = parseInt(processingOptions[key] || '0');
    const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue + increment);
    handleSingleOptionChange(key, String(newValue));
  };

  /**
   * Decrements value
   */
  const decrementValue = (key, decrement = NUMBER_INPUT_CONSTANTS.DEFAULT_INCREMENT) => {
    const currentValue = parseInt(processingOptions[key] || '1');
    const newValue = Math.max(NUMBER_INPUT_CONSTANTS.MIN_VALUE, currentValue - decrement);
    handleSingleOptionChange(key, String(newValue));
  };

  /**
   * Calculates categories applied
   */
  const calculateCategoriesApplied = (selectedTemplates, SOCIAL_MEDIA_TEMPLATES) => {
    if (!selectedTemplates || selectedTemplates.length === 0) return 0;

    const categories = new Set();
    selectedTemplates.forEach(templateId => {
      const template = SOCIAL_MEDIA_TEMPLATES.find(t => t.id === templateId);
      if (template && template.category) {
        let displayCategory = template.category;
        if (displayCategory === 'twitter') displayCategory = 'twitter/x';
        if (displayCategory === 'favicon' || displayCategory === 'screenshots') {
          categories.add(displayCategory);
        } else if (displayCategory !== 'web' && displayCategory !== 'logo') {
          categories.add(displayCategory);
        }
      }
    });

    return categories.size;
  };

  const selectedImagesForProcessing = getSelectedImagesForProcessing();
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

      <Header />

      <main className="main-content">
        <ImageUploader
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
                          <RangeSlider
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
                              <p className="text-sm text-muted mt-1">
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
                                {CROP_POSITIONS.map(position => (
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
                                      <span className="font-medium">{formatTemplateName(template.name)}</span>
                                      <span className="text-muted text-sm">
                                        {template.width}×{template.height === 'auto' ? 'auto' : template.height}
                                      </span>
                                    </div>
                                  </span>
                                </label>
                              ))}

                              {category.id === 'favicon' && (
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
                              )}
                              {category.id === 'screenshots' && (
                                <SiteScreenshots
                                  isSelected={isScreenshotSelected}
                                  onToggle={handleScreenshotToggle}
                                  onUrlChange={handleScreenshotUrlChange}
                                  screenshotUrl={screenshotUrl}
                                  validation={screenshotValidation}
                                  onScreenshotComplete={(results) => {
                                    // Handle screenshot completion if needed
                                    if (results && results.success) {
                                      showModal(
                                        t('message.success'),
                                        `Captured ${results.successful}/${results.total} screenshots successfully`,
                                        MODAL_TYPES.SUCCESS
                                      );
                                    }
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="card">
                      <div className="card-header">
                        <div className="flex justify-between items-start w-full">
                          <div className="flex-1">
                            <h4 className="card-title mb-xs">{t('templates.imageForTemplates')}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted">
                              <span className="truncate max-w-xs">
                                {templateSelectedImageObj
                                  ? templateSelectedImageObj.name
                                  : t('templates.noImageSelected')
                                }
                              </span>
                              {templateSelectedImageObj && (
                                <>
                                  <span className="flex-shrink-0">&nbsp;•&nbsp;</span>
                                  <span className="flex-shrink-0">
                                    {formatFileSize(templateSelectedImageObj.size)}
                                  </span>
                                  <span className="flex-shrink-0">&nbsp;•&nbsp;</span>
                                  <span className="flex-shrink-0">
                                    {templateSelectedImageObj.originalFormat?.toUpperCase() || templateSelectedImageObj.type.split('/')[1].toUpperCase()}
                                    {templateSelectedImageObj.isTIFF && <span className="ml-1 px-1 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">TIFF</span>}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {templateSelectedImageObj && (
                        <div className="relative w-full rounded-lg overflow-hidden bg-gray-100 image-preview-container-full mt-4">
                          {templateSelectedImageObj.isTIFF ? (
                            <div className="relative w-full h-96 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                              <img
                                alt={templateSelectedImageObj.name}
                                className="w-full h-auto object-contain max-h-full"
                                src={templateSelectedImageObj.url}
                              />
                              <div className="absolute bottom-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                <i className="fas fa-file-image mr-1"></i> TIFF
                              </div>
                            </div>
                          ) : (
                            <img
                              alt={templateSelectedImageObj.name}
                              className="w-full h-auto object-contain max-h-96"
                              src={templateSelectedImageObj.url}
                            />
                          )}
                          <div className="absolute inset-0 border border-gray-200 rounded-lg pointer-events-none"></div>
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-4 mb-lg">
                        <div className="flex items-center gap-4 text-sm text-muted">
                          <div className="flex items-center">
                            <i className="fas fa-layer-group mr-1 text-sm"></i>
                            <span>
                              {t('button.templateCount', { count: processingOptions.selectedTemplates.length })} {t('templates.selected')}
                            </span>
                          </div>
                          <span className="text-muted">,&nbsp;</span>
                          <div className="flex items-center">
                            <span>
                              {processingOptions.selectedTemplates.length > 0
                                ? `${calculateTotalTemplateFiles(processingOptions.selectedTemplates, SOCIAL_MEDIA_TEMPLATES)} ${t('templates.filesToGenerate')}`
                                : t('templates.selectTemplates')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-6">
                        <button
                          className="btn btn-primary btn-lg relative"
                          disabled={!processingOptions.templateSelectedImage || processingOptions.selectedTemplates.length === 0 || isLoading}
                          onClick={processTemplates}
                        >
                          {isLoading ? (
                            <>
                              <i className="fas fa-spinner fa-spin"></i> {t('button.processing')}
                            </>
                          ) : (
                            <>
                              <i className="fas fa-file-archive"></i> {t('templates.download')}
                              {processingOptions.selectedTemplates.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-danger text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                                  {calculateTotalTemplateFiles(processingOptions.selectedTemplates, SOCIAL_MEDIA_TEMPLATES)}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-images"></i> {t('gallery.title')} ({images.length})
                  {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && (
                    <span className="text-muted font-normal ml-md">
                      {t('gallery.templatesMode')}
                    </span>
                  )}
                </h3>
                <div className="card-actions">
                  {processingOptions.processingMode === PROCESSING_MODES.CUSTOM && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleSelectAll}
                    >
                      <i className="fas fa-check-square"></i> {selectedImages.length === images.length ? t('gallery.deselectAll') : t('gallery.selectAll')}
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={handleRemoveSelected}
                    disabled={
                      processingOptions.processingMode === PROCESSING_MODES.TEMPLATES
                        ? !processingOptions.templateSelectedImage
                        : selectedImages.length === 0
                    }
                  >
                    <i className="fas fa-trash"></i> {t('gallery.removeSelected')}
                  </button>
                </div>
              </div>

              <div className="image-grid">
                {images.map(image => {
                  const isSelected = processingOptions.processingMode === PROCESSING_MODES.TEMPLATES
                    ? image.id === processingOptions.templateSelectedImage
                    : selectedImages.includes(image.id);

                  const isTIFF = image.isTIFF;

                  return (
                    <div
                      key={image.id}
                      className={`image-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleImageSelect(image.id)}
                    >
                      <div className="image-checkbox">
                        <i className={`fas fa-${isSelected ? 'check-circle' : 'circle'}`}></i>
                      </div>
                      {processingOptions.processingMode === PROCESSING_MODES.TEMPLATES && isSelected && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-xs font-semibold px-2 py-1 rounded">
                          <i className="fas fa-th-large mr-1"></i> {t('gallery.templateImage')}
                        </div>
                      )}

                      {isTIFF ? (
                        <div className="relative">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="image-preview"
                          />
                          <div className="tiff-badge-overlay">
                            <span className="tiff-badge">TIFF</span>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={image.url}
                          alt={image.name}
                          className="image-preview"
                        />
                      )}

                      <div className="image-info">
                        <span className="image-name">{image.name}</span>
                        <span className="image-size">
                          {formatFileSize(image.size)} • {image.originalFormat?.toUpperCase() || image.type.split('/')[1].toUpperCase()}
                          {isTIFF && <span className="image-format-badge">TIFF</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />

      <Modal
        isOpen={modal.isOpen && modal.type !== MODAL_TYPES.SUMMARY}
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      <Modal
        isOpen={modal.isOpen && modal.type === MODAL_TYPES.SUMMARY}
        onClose={closeModal}
        title={modal.title}
        type={MODAL_TYPES.SUMMARY}
        actions={
          <button className="btn btn-primary" onClick={closeModal}>
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

                <div className="summary-item">
                  <div className="summary-label">
                    {processingSummary.mode === 'templates'
                      ? t('summary.templatesApplied') + ':'
                      : t('summary.imagesProcessed') + ':'}
                  </div>
                  <div className="summary-value">
                    {processingSummary.mode === 'templates'
                      ? processingSummary.templatesApplied + ' templates applied'
                      : processingSummary.imagesProcessed + ' images processed'}
                  </div>
                </div>

                {processingSummary.screenshotCount > 0 && (
                  <div className="summary-item">
                    <div className="summary-label">Screenshots Captured:</div>
                    <div className="summary-value text-success">
                      <i className="fas fa-camera mr-1"></i>
                      {processingSummary.screenshotCount} screenshots
                    </div>
                  </div>
                )}

                {processingSummary.mode === 'templates' && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.categoriesApplied')}:</div>
                    <div className="summary-value">{processingSummary.categoriesApplied}</div>
                  </div>
                )}

                <div className="summary-item">
                  <div className="summary-label">{t('summary.formatsExported')}:</div>
                  <div className="summary-value">
                    {processingSummary.formatsExported && processingSummary.formatsExported.length > 0
                      ? processingSummary.formatsExported.map(format => (
                        <span key={format} className="format-badge">
                          {format.toUpperCase()}
                        </span>
                      ))
                      : 'WEBP, JPG, PNG'}
                  </div>
                </div>

                <div className="summary-item">
                  <div className="summary-label">{t('summary.totalFiles')}:</div>
                  <div className="summary-value">{processingSummary.totalFiles} files generated</div>
                </div>

                <div className="summary-item">
                  <div className="summary-label">{t('summary.aiUsed')}:</div>
                  <div className="summary-value">
                    {processingSummary.aiUsed ? (
                      <span className="text-success">
                        <i className="fas fa-brain mr-1"></i> Yes
                      </span>
                    ) : (
                      <span className="text-muted">No</span>
                    )}
                  </div>
                </div>

                {processingSummary.upscalingUsed && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.upscalingUsed')}:</div>
                    <div className="summary-value text-success">
                      <i className="fas fa-expand-arrows-alt mr-1"></i> Yes
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
      </Modal>
    </div>
  );
}

export default App;
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ImageUploader from './components/ImageUploader';
import Header from './components/Header';
import Footer from './components/Footer';
import Modal from './components/Modal';
import RangeSlider from './components/RangeSlider';
import { createExportZip, downloadZip, generateExportSettings } from './utils/exportUtils';
import {
  orchestrateCustomProcessing,
  orchestrateTemplateProcessing,
  createImageObjects,
  loadAIModel,
  validateProcessingOptions,
  getProcessingConfiguration,
  createProcessingSummary,
  calculateTotalTemplateFiles,
  formatFileSize,
  cleanupBlobUrls,
  getAvailableFormats,
  getTemplateById,
  getTemplatesByCategory,
  generateFileName
} from './utils/imageProcessor';
import { getTemplateCategories, SOCIAL_MEDIA_TEMPLATES } from './configs/templateConfigs';
import './styles/App.css';

/**
 * Main application component for image processing and optimization.
 *
 * @returns {JSX.Element} Rendered application
 */
function App() {
  const { t, i18n } = useTranslation();
  const [images, setImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [aiModelLoaded, setAiModelLoaded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [processingSummary, setProcessingSummary] = useState(null);
  const [processingOptions, setProcessingOptions] = useState({
    compression: {
      quality: 80,
      fileSize: ''
    },
    output: {
      formats: ['webp'],
      rename: false,
      newFileName: ''
    },
    resizeDimension: '',
    cropWidth: '',
    cropHeight: '',
    showResize: true,
    showCrop: false,
    showTemplates: false,
    selectedTemplates: [],
    processingMode: 'custom',
    templateSelectedImage: null,
    smartCrop: false,
    cropMode: 'smart',
    cropPosition: 'center'
  });

  const fileInputRef = useRef(null);

  /**
   * Loads AI model when needed for smart cropping or templates.
   */
  useEffect(() => {
    const loadAIModelAsync = async () => {
      const needsAI = (processingOptions.cropMode === 'smart' && !aiModelLoaded) ||
        (processingOptions.processingMode === 'templates' && !aiModelLoaded);

      if (needsAI) {
        try {
          setAiLoading(true);
          await loadAIModel();
          setAiModelLoaded(true);
          setAiLoading(false);
        } catch (error) {
          console.error('Failed to load AI model:', error);
          setAiLoading(false);
          showModal(t('message.error'), t('message.aiFailed'), 'error');

          if (processingOptions.cropMode === 'smart') {
            setProcessingOptions(prev => ({ ...prev, cropMode: 'standard' }));
          }
        }
      }
    };
    loadAIModelAsync();
  }, [processingOptions.cropMode, processingOptions.processingMode, t]);

  /**
   * Cleans up blob URLs when component unmounts.
   */
  useEffect(() => {
    return () => {
      cleanupBlobUrls(images);
    };
  }, []);

  /**
   * Handles image upload from file input or drag-and-drop.
   *
   * @param {File[]} files - Array of uploaded image files
   */
  const handleImageUpload = (files) => {
    const newImages = createImageObjects(files);
    setImages(prev => {
      cleanupBlobUrls(prev);
      return [...prev, ...newImages];
    });

    if (processingOptions.processingMode === 'custom') {
      if (selectedImages.length === 0) {
        setSelectedImages(newImages.map(img => img.id));
      } else {
        setSelectedImages(prev => [...prev, ...newImages.map(img => img.id)]);
      }
    }

    if ((processingOptions.processingMode === 'templates' || processingOptions.showTemplates) &&
      !processingOptions.templateSelectedImage &&
      newImages.length > 0) {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: newImages[0].id
      }));
    }

    showModal(t('message.success'), t('message.successUpload', { count: files.length }), 'success');
  };

  /**
   * Handles image selection in gallery.
   *
   * @param {string} imageId - Unique identifier of the image
   */
  const handleImageSelect = (imageId) => {
    if (processingOptions.processingMode === 'templates') {
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
   * Selects or deselects all images.
   */
  const handleSelectAll = () => {
    if (processingOptions.processingMode === 'templates') return;

    if (selectedImages.length === images.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages(images.map(img => img.id));
    }
  };

  /**
   * Removes selected images from the gallery.
   */
  const handleRemoveSelected = () => {
    const imagesToRemove = processingOptions.processingMode === 'templates'
      ? [processingOptions.templateSelectedImage].filter(Boolean)
      : selectedImages;

    const imagesToRemoveObjects = images.filter(img => imagesToRemove.includes(img.id));
    cleanupBlobUrls(imagesToRemoveObjects);

    setImages(images.filter(img => !imagesToRemove.includes(img.id)));
    setSelectedImages([]);

    if (processingOptions.processingMode === 'templates') {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: null
      }));
    }

    showModal(t('message.removed'), t('message.removedImages'), 'success');
  };

  /**
   * Displays modal dialog.
   *
   * @param {string} title - Modal title
   * @param {string} message - Modal message content
   * @param {string} type - Modal type ('info', 'success', 'error', 'summary')
   */
  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  /**
   * Shows summary modal with processing details.
   *
   * @param {Object} summary - Processing summary object
   */
  const showSummaryModal = (summary) => {
    setProcessingSummary(summary);
    setModal({
      isOpen: true,
      title: t('summary.title'),
      message: '',
      type: 'summary'
    });
  };

  /**
   * Closes modal dialog.
   */
  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
    setProcessingSummary(null);
  };

  /**
   * Toggles between resize and crop modes.
   */
  const toggleResizeCrop = () => {
    setProcessingOptions(prev => ({
      ...prev,
      showResize: !prev.showResize,
      showCrop: !prev.showCrop
    }));
  };

  /**
   * Toggles crop mode between standard and smart.
   */
  const toggleCropMode = () => {
    setProcessingOptions(prev => ({
      ...prev,
      cropMode: prev.cropMode === 'smart' ? 'standard' : 'smart'
    }));
  };

  /**
   * Toggles format selection.
   *
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
   * Selects all output formats.
   */
  const handleSelectAllFormats = () => {
    const allFormats = ['webp', 'jpg', 'png', 'original'];
    setProcessingOptions(prev => ({
      ...prev,
      output: {
        ...prev.output,
        formats: allFormats
      }
    }));
  };

  /**
   * Clears all output formats.
   */
  const handleClearAllFormats = () => {
    setProcessingOptions(prev => ({
      ...prev,
      output: {
        ...prev.output,
        formats: ['webp']
      }
    }));
  };

  /**
   * Switches between custom processing and templates mode.
   *
   * @param {'custom'|'templates'} mode - Processing mode
   */
  const toggleProcessingMode = (mode) => {
    const newMode = mode === 'templates' ? 'templates' : 'custom';

    if (newMode === 'templates') {
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
        showTemplates: newMode === 'templates',
        templateSelectedImage: null
      }));
    }
  };

  /**
   * Toggles selection of a specific template.
   *
   * @param {string} templateId - Unique identifier of the template
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
   * Selects all available templates.
   */
  const handleSelectAllTemplates = () => {
    const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id);
    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: allTemplateIds
    }));
  };

  /**
   * Selects all templates in a specific category.
   *
   * @param {string} category - Template category identifier
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
   * Deselects all templates in a specific category.
   *
   * @param {string} category - Template category identifier
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
   * Updates processing options.
   *
   * @param {string} category - Option category
   * @param {string} key - Option key within the category
   * @param {any} value - New option value
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
   * Updates single processing option.
   *
   * @param {string} key - Option key to update
   * @param {any} value - New option value
   */
  const handleSingleOptionChange = (key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Gets currently selected images for processing.
   *
   * @returns {Array<Object>} Array of selected image objects
   */
  const getSelectedImagesForProcessing = () => {
    if (processingOptions.processingMode === 'templates') {
      return processingOptions.templateSelectedImage
        ? images.filter(img => img.id === processingOptions.templateSelectedImage)
        : [];
    } else {
      return images.filter(img => selectedImages.includes(img.id));
    }
  };

  /**
   * Processes images using custom settings.
   */
  const processCustomImages = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing();
    if (selectedImagesForProcessing.length === 0) {
      showModal(t('message.error'), t('message.errorSelectImages'), 'error');
      return;
    }

    const validation = validateProcessingOptions(processingOptions);
    if (!validation.isValid) {
      showModal(t('message.error'), validation.errors.join('\n'), 'error');
      return;
    }

    setIsLoading(true);
    showModal(t('message.processingImages'), t('message.processingImages', { count: selectedImagesForProcessing.length }), 'info');

    try {
      const processingConfig = getProcessingConfiguration(processingOptions);
      const processedImages = await orchestrateCustomProcessing(
        selectedImagesForProcessing,
        processingConfig,
        aiModelLoaded,
        (stage, progress) => {
          console.log(`Processing ${stage}: ${progress}%`);
        }
      );

      const settings = generateExportSettings('custom');
      const zipBlob = await createExportZip(
        selectedImagesForProcessing,
        processedImages,
        settings,
        'custom',
        processingOptions.output.formats
      );

      downloadZip(zipBlob, 'custom-processed-images');

      const summary = createProcessingSummary({
        imagesProcessed: selectedImagesForProcessing.length,
        totalFiles: processedImages.length,
        success: true
      }, processingConfig, t);

      closeModal();
      showSummaryModal(summary);

    } catch (error) {
      console.error('Custom processing error:', error);
      showModal(t('message.error'), t('message.errorProcessing'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Processes images using social media templates.
   */
  const processTemplates = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing();
    if (selectedImagesForProcessing.length === 0) {
      showModal(t('message.error'), t('message.errorSelectImage'), 'error');
      return;
    }

    if (processingOptions.selectedTemplates.length === 0) {
      showModal(t('message.error'), t('message.errorSelectTemplate'), 'error');
      return;
    }

    setIsLoading(true);
    showModal(t('message.processingImages'), t('message.processingImages', { count: processingOptions.selectedTemplates.length }), 'info');

    try {
      const processingConfig = getProcessingConfiguration(processingOptions);
      const processedImages = await orchestrateTemplateProcessing(
        selectedImagesForProcessing[0],
        processingOptions.selectedTemplates,
        SOCIAL_MEDIA_TEMPLATES,
        true,
        aiModelLoaded,
        (stage, progress) => {
          console.log(`Template processing ${stage}: ${progress}%`);
        }
      );

      const settings = generateExportSettings('templates');
      const zipBlob = await createExportZip([selectedImagesForProcessing[0]], processedImages, settings, 'templates');
      downloadZip(zipBlob, 'template-images');

      const summary = createProcessingSummary({
        imagesProcessed: 1,
        totalFiles: processedImages.length,
        success: true
      }, processingConfig, t);

      closeModal();
      showSummaryModal(summary);

    } catch (error) {
      console.error('Template processing error:', error);
      showModal(t('message.error'), t('message.errorApplying'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formats template names for display using translations.
   *
   * @param {string} name - Original template name
   * @returns {string} Formatted display name
   */
  const formatTemplateName = (name) => {
    return t(`template.${name}`) || name;
  };

  /**
   * Increments number value.
   *
   * @param {string} key - State key to update
   * @param {number} increment - Amount to increment by
   */
  const incrementValue = (key, increment = 1) => {
    const currentValue = parseInt(processingOptions[key] || '0');
    const newValue = Math.max(1, currentValue + increment);
    handleSingleOptionChange(key, String(newValue));
  };

  /**
   * Decrements number value.
   *
   * @param {string} key - State key to update
   * @param {number} decrement - Amount to decrement by
   */
  const decrementValue = (key, decrement = 1) => {
    const currentValue = parseInt(processingOptions[key] || '1');
    const newValue = Math.max(1, currentValue - decrement);
    handleSingleOptionChange(key, String(newValue));
  };

  // UI state
  const selectedImagesForProcessing = getSelectedImagesForProcessing();
  const templateCategories = getTemplateCategories();
  const templateSelectedImageObj = images.find(img => img.id === processingOptions.templateSelectedImage);

  return (
    <div className="app">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin fa-3x"></i>
            <p>{t('loading.preparing')}</p>
            <p className="text-muted text-sm mt-2">
              {processingOptions.processingMode === 'templates' && aiModelLoaded
                ? t('loading.aiCropping')
                : t('loading.upscalingWhenNeeded')}
            </p>
          </div>
        </div>
      )}

      {/* AI Model Loading Overlay */}
      {aiLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-brain fa-spin fa-3x"></i>
            <p>{t('loading.aiModel')}</p>
            <p className="text-muted">{t('loading.oncePerSession')}</p>
            <p className="text-sm mt-2">
              {processingOptions.processingMode === 'templates'
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
            {/* Mode Selection */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <i className="fas fa-sliders-h"></i> {t('mode.title')}
                </h2>
                <div className="card-actions">
                  <button
                    className={`btn ${processingOptions.processingMode === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('custom')}
                  >
                    <i className="fas fa-sliders-h"></i> {t('mode.custom')}
                  </button>
                  <button
                    className={`btn ${processingOptions.processingMode === 'templates' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('templates')}
                  >
                    <i className="fas fa-th-large"></i> {t('mode.templates')}
                  </button>
                </div>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                {processingOptions.processingMode === 'templates'
                  ? t('mode.templatesInfo')
                  : t('mode.customInfo')
                }
              </div>

              {processingOptions.processingMode === 'custom' ? (
                <>
                  <div className="grid grid-cols-auto gap-lg mb-lg">
                    {/* Compression Card */}
                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-compress"></i> {t('compression.title')}
                      </h3>
                      <div className="form-group">
                        <div className="range-wrapper">
                          <RangeSlider
                            label={t('compression.quality')}
                            min={1}
                            max={100}
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
                            min="1"
                          />
                          <div className="number-input-spinner">
                            <button
                              type="button"
                              className="number-input-button"
                              onClick={() => handleOptionChange('compression', 'fileSize', String(parseInt(processingOptions.compression.fileSize || 0) + 10))}
                            >
                              <i className="fas fa-chevron-up"></i>
                            </button>
                            <button
                              type="button"
                              className="number-input-button"
                              onClick={() => handleOptionChange('compression', 'fileSize', String(Math.max(1, parseInt(processingOptions.compression.fileSize || 10) - 10)))}
                            >
                              <i className="fas fa-chevron-down"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Output Card */}
                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-file-export"></i> {t('output.title')}
                      </h3>

                      {/* Format Selection */}
                      <div className="form-group">
                        <label className="form-label">{t('output.format')}</label>
                        <div className="space-y-sm mb-md">
                          {/* Format checkboxes */}
                          <div className="grid grid-cols-2 gap-sm">
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes('webp')}
                                onChange={() => handleFormatToggle('webp')}
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
                                checked={processingOptions.output.formats.includes('jpg')}
                                onChange={() => handleFormatToggle('jpg')}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.jpg')}</span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes('png')}
                                onChange={() => handleFormatToggle('png')}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.png')}</span>
                            </label>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                className="checkbox-input"
                                checked={processingOptions.output.formats.includes('original')}
                                onChange={() => handleFormatToggle('original')}
                              />
                              <span className="checkbox-custom"></span>
                              <span className="checkbox-label">{t('output.format.original')}</span>
                            </label>
                          </div>

                          {/* Quick selection buttons */}
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

                    {/* Resize/Crop Card */}
                    <div className="card">
                      <h3 className="card-title">
                        {processingOptions.showResize ? (
                          <>
                            <i className="fas fa-expand-alt"></i> {t('resize.title')}
                          </>
                        ) : (
                          <>
                            <i className="fas fa-crop-alt"></i> {t('crop.title')}
                            <span className="ml-2 text-sm text-muted">
                              ({processingOptions.cropMode === 'smart' ? t('crop.switchToSmart') : t('crop.switchToStandard')})
                            </span>
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
                              placeholder="e.g., 1080"
                              min="1"
                            />
                            <div className="number-input-spinner">
                              <button
                                type="button"
                                className="number-input-button"
                                onClick={() => incrementValue('resizeDimension', 10)}
                              >
                                <i className="fas fa-chevron-up"></i>
                              </button>
                              <button
                                type="button"
                                className="number-input-button"
                                onClick={() => decrementValue('resizeDimension', 10)}
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
                                className={`btn ${processingOptions.cropMode === 'smart' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={toggleCropMode}
                                disabled={aiLoading}
                              >
                                {processingOptions.cropMode === 'smart' ? (
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
                            {processingOptions.cropMode === 'smart' && (
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
                                  placeholder="Width"
                                  min="1"
                                  disabled={aiLoading && processingOptions.cropMode === 'smart'}
                                />
                                <div className="number-input-spinner">
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => incrementValue('cropWidth')}
                                    disabled={aiLoading && processingOptions.cropMode === 'smart'}
                                  >
                                    <i className="fas fa-chevron-up"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => decrementValue('cropWidth')}
                                    disabled={aiLoading && processingOptions.cropMode === 'smart'}
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
                                  placeholder="Height"
                                  min="1"
                                  disabled={aiLoading && processingOptions.cropMode === 'smart'}
                                />
                                <div className="number-input-spinner">
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => incrementValue('cropHeight')}
                                    disabled={aiLoading && processingOptions.cropMode === 'smart'}
                                  >
                                    <i className="fas fa-chevron-up"></i>
                                  </button>
                                  <button
                                    type="button"
                                    className="number-input-button"
                                    onClick={() => decrementValue('cropHeight')}
                                    disabled={aiLoading && processingOptions.cropMode === 'smart'}
                                  >
                                    <i className="fas fa-chevron-down"></i>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Position selector for standard crop */}
                          {processingOptions.cropMode === 'standard' && (
                            <div className="form-group">
                              <label className="form-label">{t('crop.position')}</label>
                              <select
                                value={processingOptions.cropPosition}
                                onChange={(e) => handleSingleOptionChange('cropPosition', e.target.value)}
                                className="select-field"
                              >
                                <option value="center">{t('crop.position.center')}</option>
                                <option value="top-left">{t('crop.position.topLeft')}</option>
                                <option value="top">{t('crop.position.top')}</option>
                                <option value="top-right">{t('crop.position.topRight')}</option>
                                <option value="left">{t('crop.position.left')}</option>
                                <option value="right">{t('crop.position.right')}</option>
                                <option value="bottom-left">{t('crop.position.bottomLeft')}</option>
                                <option value="bottom">{t('crop.position.bottom')}</option>
                                <option value="bottom-right">{t('crop.position.bottomRight')}</option>
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
                      disabled={selectedImagesForProcessing.length === 0 || isLoading || (processingOptions.cropMode === 'smart' && aiLoading) || !processingOptions.output.formats || processingOptions.output.formats.length === 0}
                      onClick={processCustomImages}
                    >
                      {isLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> {t('button.processing')}
                        </>
                      ) : processingOptions.cropMode === 'smart' && aiLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> {t('button.loadingAI')}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-download"></i> {t('button.process')}
                          <span className="ml-1">
                            ({selectedImagesForProcessing.length} images × {processingOptions.output.formats.length} formats)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Templates Selection */}
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
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Template Action Section */}
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
                                    {templateSelectedImageObj.type.split('/')[1].toUpperCase()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Full-width image preview */}
                      {templateSelectedImageObj && (
                        <div className="relative w-full rounded-lg overflow-hidden bg-gray-100 image-preview-container-full mt-4">
                          <img
                            alt={templateSelectedImageObj.name}
                            className="w-full h-auto object-contain max-h-96"
                            src={templateSelectedImageObj.url}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const container = e.target.parentElement;
                              container.innerHTML = `
                                                                <div class="w-full h-64 bg-primary flex items-center justify-center">
                                                                    <i class="fas fa-image text-white text-4xl"></i>
                                                                </div>
                                                                <div class="absolute inset-0 border border-gray-200 rounded-lg pointer-events-none"></div>
                                                            `;
                            }}
                          />
                          <div className="absolute inset-0 border border-gray-200 rounded-lg pointer-events-none"></div>
                        </div>
                      )}

                      {/* Template stats row */}
                      <div className="flex justify-between items-center mt-4 mb-lg">
                        <div className="flex items-center gap-4 text-sm text-muted">
                          <div className="flex items-center">
                            <i className="fas fa-layer-group mr-1 text-sm"></i>
                            <span>
                              {processingOptions.selectedTemplates.length} {t('templates.selected')}
                            </span>
                          </div>
                          <span className="text-muted">,&nbsp;</span>
                          <div className="flex items-center">
                            <span>
                              {processingOptions.selectedTemplates.length > 0
                                ? `${calculateTotalTemplateFiles(processingOptions.selectedTemplates, SOCIAL_MEDIA_TEMPLATES)} ${t('templates.filesToGenerate')}`
                                : t('templates.selectTemplates')
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Download button */}
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

            {/* Image Gallery */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-images"></i> {t('gallery.title')} ({images.length})
                  {processingOptions.processingMode === 'templates' && (
                    <span className="text-muted font-normal ml-md">
                      {t('gallery.templatesMode')}
                    </span>
                  )}
                </h3>
                <div className="card-actions">
                  {processingOptions.processingMode === 'custom' && (
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
                      processingOptions.processingMode === 'templates'
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
                  const isSelected = processingOptions.processingMode === 'templates'
                    ? image.id === processingOptions.templateSelectedImage
                    : selectedImages.includes(image.id);

                  return (
                    <div
                      key={image.id}
                      className={`image-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleImageSelect(image.id)}
                    >
                      <div className="image-checkbox">
                        <i className={`fas fa-${isSelected ? 'check-circle' : 'circle'}`}></i>
                      </div>
                      {processingOptions.processingMode === 'templates' && isSelected && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-xs font-semibold px-2 py-1 rounded">
                          <i className="fas fa-th-large mr-1"></i> {t('gallery.templateImage')}
                        </div>
                      )}
                      <img src={image.url} alt={image.name} />
                      <div className="image-info">
                        <span className="image-name">{image.name}</span>
                        <span className="image-size">{formatFileSize(image.size)} • {image.type.split('/')[1].toUpperCase()}</span>
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

      {/* Regular Modal */}
      <Modal
        isOpen={modal.isOpen && modal.type !== 'summary'}
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      {/* Summary Modal */}
      <Modal
        isOpen={modal.isOpen && modal.type === 'summary'}
        onClose={closeModal}
        title={modal.title}
        type="summary"
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
                      ? t('summary.templatesApplied')
                      : t('summary.imagesProcessed')}:
                  </div>
                  <div className="summary-value">
                    {processingSummary.mode === 'templates'
                      ? `${processingSummary.templatesApplied} templates`
                      : processingSummary.imagesProcessed}
                  </div>
                </div>

                {processingSummary.mode === 'templates' && (
                  <div className="summary-item">
                    <div className="summary-label">{t('summary.categoriesApplied')}:</div>
                    <div className="summary-value">{processingSummary.categoriesApplied}</div>
                  </div>
                )}

                <div className="summary-item">
                  <div className="summary-label">{t('summary.formatsExported')}:</div>
                  <div className="summary-value">
                    {processingSummary.formatsExported.map(format => (
                      <span key={format} className="format-badge">
                        {format.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="summary-item">
                  <div className="summary-label">{t('summary.totalFiles')}:</div>
                  <div className="summary-value">{processingSummary.totalFiles}</div>
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

            <div className="alert alert-success mt-4">
              <i className="fas fa-info-circle"></i>
              {t('summary.downloadComplete')}
              {processingSummary.mode === 'templates' && (
                <div className="mt-1 text-sm">
                  {t('summary.templatesNote', { count: processingSummary.templatesApplied })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default App;
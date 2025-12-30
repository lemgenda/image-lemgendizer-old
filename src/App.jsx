import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createImageObjects,
  loadAIModel,
  getProcessingConfiguration,
  createProcessingSummary,
  cleanupBlobUrls,
  createExportZip,
  createScreenshotZip,
  downloadZip,
  generateExportSettings,
  loadUTIFLibrary,
  getTranslatedTemplateName,
  checkImageTransparencyQuick
} from './processors';
import {
  captureMultipleScreenshots,
  convertScreenshotResultsToImages,
  validateScreenshotUrlInput,
  orchestrateCustomProcessing,
  orchestrateTemplateProcessing,
  validateProcessingOptions,
  formatFileSize,
  safeCleanupGPUMemory
} from './utils';
import {
  getTemplateCategories,
  SOCIAL_MEDIA_TEMPLATES,
  SCREENSHOT_TEMPLATES,
  DEFAULT_FAVICON_BACKGROUND_COLOR,
  DEFAULT_FAVICON_SITE_NAME,
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
  NUMBER_INPUT_CONSTANTS,
  IMAGE_FORMATS,
  CROP_POSITIONS,
  RESIZE_DIMENSION_RANGE,
  CROP_DIMENSION_RANGE,
  ANIMATION_DURATIONS,
  PROCESSING_DELAYS
} from './constants/sharedConstants';
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

  let autoCloseTimeout = null;

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
        } catch (error) {
        }
      });
      cleanupBlobUrls(images);
    };
  }, [images]);

  useEffect(() => {
    return () => {
      // Clean up any remaining preview URLs
      images.forEach(image => {
        if (image.url && image.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(image.url);
          } catch (e) {
            // Ignore errors
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
      }
    };
  }, []);

  /**
   * Updates processing modal progress
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

  const handleScreenshotUrlChange = (url) => {
    setScreenshotUrl(url);
    const validation = validateScreenshotUrlInput(url);
    setScreenshotValidation(validation);
  };

  const handleImageUpload = async (files) => {
    try {
      setIsLoading(true);

      // Validate files before processing
      const validFiles = Array.from(files).filter(file => {
        if (!file || !file.type) return false;

        const mimeType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        // Check for supported image formats
        const supportedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
          'image/gif', 'image/bmp', 'image/tiff', 'image/tif',
          'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
          'image/avif', 'image/apng'
        ];

        const supportedExtensions = [
          '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
          '.tiff', '.tif', '.svg', '.ico', '.avif', '.apng'
        ];

        return supportedTypes.includes(mimeType) ||
          supportedExtensions.some(ext => fileName.endsWith(ext));
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

      // Create image objects with proper preview handling
      const newImages = await createImageObjects(validFiles);

      // Generate additional preview data for each image
      const enhancedImages = await Promise.all(
        newImages.map(async (img) => {
          try {
            // Generate a reliable preview URL
            let previewUrl = img.url;

            // For TIFF and SVG, generate canvas preview to ensure display
            if (img.isTIFF || img.isSVG) {
              try {
                const canvasPreview = await generateSpecialFormatPreview(img);
                previewUrl = canvasPreview;
              } catch (previewError) {
                // Fallback to blob URL
                console.warn(`Failed to generate preview for ${img.name}:`, previewError);
              }
            }

            // Ensure the URL is valid and accessible
            if (!previewUrl || !previewUrl.startsWith('blob:') && !previewUrl.startsWith('data:')) {
              // Create a new blob URL if needed
              previewUrl = URL.createObjectURL(img.file);
            }

            return {
              ...img,
              url: previewUrl,
              previewGenerated: true,
              previewType: img.isTIFF ? 'tiff' : img.isSVG ? 'svg' : 'regular',
              uploadTime: Date.now(),
              // Add metadata for better display
              metadata: {
                dimensions: await getImageDimensions(img.file, img.isTIFF, img.isSVG),
                hasTransparency: await checkImageTransparencyQuick(img.file)
              }
            };
          } catch (error) {
            console.error(`Error enhancing image ${img.name}:`, error);
            // Return the basic image object if enhancement fails
            return {
              ...img,
              previewGenerated: false,
              error: error.message
            };
          }
        })
      );

      // Clean up old images' blob URLs
      cleanupBlobUrls(images);

      // Update images state
      setImages(prev => [...prev, ...enhancedImages]);

      // Update selected images based on processing mode
      if (processingOptions.processingMode === PROCESSING_MODES.CUSTOM) {
        if (selectedImages.length === 0) {
          // Select all new images in custom mode
          setSelectedImages(enhancedImages.map(img => img.id));
        } else {
          // Add new images to existing selection
          setSelectedImages(prev => [...prev, ...enhancedImages.map(img => img.id)]);
        }
      }

      // In template mode, auto-select first image if none selected
      if ((processingOptions.processingMode === PROCESSING_MODES.TEMPLATES || processingOptions.showTemplates) &&
        !processingOptions.templateSelectedImage &&
        enhancedImages.length > 0) {
        setProcessingOptions(prev => ({
          ...prev,
          templateSelectedImage: enhancedImages[0].id
        }));
        setSelectedImages([enhancedImages[0].id]);
      }

      // Show success message
      showModal(
        t('message.success'),
        t('message.successUpload', {
          count: enhancedImages.length,
          skipped: files.length - enhancedImages.length
        }),
        MODAL_TYPES.SUCCESS
      );

      // Scroll to gallery if many images were added
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
      console.error('Error in handleImageUpload:', error);
      showModal(
        t('message.error'),
        t('message.errorUpload') + ': ' + error.message,
        MODAL_TYPES.ERROR
      );
    } finally {
      setIsLoading(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper function to generate preview for special formats
  const generateSpecialFormatPreview = async (image) => {
    return new Promise((resolve, reject) => {
      if (image.isTIFF) {
        generateTiffPreview(image.file)
          .then(resolve)
          .catch(reject);
      } else if (image.isSVG) {
        generateSvgPreview(image.file)
          .then(resolve)
          .catch(reject);
      } else {
        // For regular images, create a blob URL
        resolve(URL.createObjectURL(image.file));
      }
    });
  };

  // Helper function to generate TIFF preview
  const generateTiffPreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 150;
          const ctx = canvas.getContext('2d');

          // Draw TIFF placeholder
          ctx.fillStyle = '#f0f8ff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw border
          ctx.strokeStyle = '#007bff';
          ctx.lineWidth = 2;
          ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

          // Draw TIFF icon
          ctx.fillStyle = '#007bff';
          ctx.font = 'bold 32px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📄', canvas.width / 2, canvas.height / 2 - 15);

          // Draw text
          ctx.fillStyle = '#333';
          ctx.font = '12px Arial';
          ctx.fillText('TIFF IMAGE', canvas.width / 2, canvas.height / 2 + 15);

          resolve(canvas.toDataURL('image/png'));
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper function to generate SVG preview
  const generateSvgPreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const svgText = e.target.result;
          const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(img.width, 200);
            canvas.height = Math.min(img.height, 150);
            const ctx = canvas.getContext('2d');

            // White background for SVG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(svgUrl);
            resolve(canvas.toDataURL('image/png'));
          };

          img.onerror = () => {
            URL.revokeObjectURL(svgUrl);
            reject(new Error('Failed to load SVG'));
          };

          img.src = svgUrl;
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Helper function to get image dimensions
  const getImageDimensions = (file, isTIFF, isSVG) => {
    return new Promise((resolve) => {
      if (isSVG) {
        // Parse SVG dimensions
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(e.target.result, 'image/svg+xml');
            const svgElement = svgDoc.documentElement;

            let width = parseInt(svgElement.getAttribute('width')) || 100;
            let height = parseInt(svgElement.getAttribute('height')) || 100;

            if (!width || !height) {
              const viewBox = svgElement.getAttribute('viewBox');
              if (viewBox) {
                const parts = viewBox.split(' ').map(Number);
                if (parts.length >= 4) {
                  width = parts[2] || 100;
                  height = parts[3] || 100;
                }
              }
            }

            resolve({ width, height });
          } catch {
            resolve({ width: 100, height: 100 });
          }
        };
        reader.onerror = () => resolve({ width: 100, height: 100 });
        reader.readAsText(file);
      } else {
        // For regular images and TIFF
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          resolve({
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          });
          URL.revokeObjectURL(url);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ width: 100, height: 100 });
        };

        img.src = url;
      }
    });
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

  const setupAutoClose = (type) => {
    // Clear any existing timeout
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }

    if (!userInteractedWithModal) {
      let timeoutDuration;
      switch (type) {
        case MODAL_TYPES.SUCCESS:
          timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_SUCCESS;
          break;
        case MODAL_TYPES.INFO:
          timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_INFO;
          break;
        case MODAL_TYPES.ERROR:
          timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_ERROR;
          break;
        case MODAL_TYPES.SUMMARY:
          timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_SUMMARY;
          break;
        case MODAL_TYPES.WARNING:
          timeoutDuration = ANIMATION_DURATIONS.MODAL_CLOSE_INFO;
          break;
        default:
          timeoutDuration = 3000;
      }

      console.log(`Setting auto-close for ${type} modal: ${timeoutDuration}ms`);

      autoCloseTimeoutRef.current = setTimeout(() => {
        console.log(`Auto-closing ${type} modal`);
        closeModal();
      }, timeoutDuration);
    } else {
      console.log(`Not auto-closing ${type} modal - user interacted`);
    }
  };

  const showModal = (title, message, type = MODAL_TYPES.INFO, showProgress = false, progress = 0, progressStep = '') => {
    // Clear any existing timeout
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
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

    // Set auto-close for non-progress modals
    if (!showProgress) {
      let timeoutDuration = 3000; // Default

      if (type === MODAL_TYPES.SUCCESS) timeoutDuration = 3000;
      else if (type === MODAL_TYPES.INFO) timeoutDuration = 5000;
      else if (type === MODAL_TYPES.ERROR) timeoutDuration = 7000;
      else if (type === MODAL_TYPES.SUMMARY) timeoutDuration = 8000;
      else if (type === MODAL_TYPES.WARNING) timeoutDuration = 5000;

      autoCloseTimeout = setTimeout(() => {
        closeModal();
      }, timeoutDuration);
    }
  };

  const showSummaryModal = (summary) => {
    // Clear any existing timeout
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
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

    // Set auto-close for summary
    autoCloseTimeout = setTimeout(() => {
      closeModal();
    }, 8000);
  };

  const closeModal = () => {
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
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

  const handleModalInteraction = () => {
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
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
    setProcessingOptions(prev => ({
      ...prev,
      cropMode: prev.cropMode === CROP_MODES.SMART ? CROP_MODES.STANDARD : CROP_MODES.SMART
    }));
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
        formats: ALL_OUTPUT_FORMATS
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

  const getSelectedImagesForProcessing = () => {
    if (processingOptions.processingMode === PROCESSING_MODES.TEMPLATES) {
      return processingOptions.templateSelectedImage
        ? images.filter(img => img.id === processingOptions.templateSelectedImage)
        : [];
    } else {
      return images.filter(img => selectedImages.includes(img.id));
    }
  };

  const processCustomImages = async () => {
    console.log('=== STARTING CUSTOM IMAGE PROCESSING ===');

    const selectedImagesForProcessing = getSelectedImagesForProcessing();
    console.log('Selected images for processing:', selectedImagesForProcessing.length);

    if (selectedImagesForProcessing.length === 0) {
      console.error('No images selected for processing');
      showModal(t('message.error'), t('message.errorSelectImages'), MODAL_TYPES.ERROR);
      return;
    }

    // USE THE VALIDATION HELPER
    console.log('Validating images before processing...');
    const validationIssues = validateImageFilesBeforeProcessing(selectedImagesForProcessing);
    if (validationIssues.length > 0) {
      console.warn('Image validation issues found:', validationIssues);

      // Show warning but continue processing
      if (validationIssues.length === selectedImagesForProcessing.length) {
        // All images have issues
        const issuesList = validationIssues.map(issue =>
          `${issue.image}: ${issue.issue}`
        ).join('\n');

        showModal(
          t('message.error'),
          `${t('message.errorProcessing')}:\n${issuesList}`,
          MODAL_TYPES.ERROR
        );
        return;
      } else {
        // Some images have issues
        const warningMessage = `${validationIssues.length} image(s) have issues but processing will continue with the rest.`;
        console.warn(warningMessage);
      }
    }

    const validation = validateProcessingOptions(processingOptions);
    if (!validation.isValid) {
      console.error('Processing options validation failed:', validation.errors);
      showModal(t('message.error'), validation.errors.join('\n'), MODAL_TYPES.ERROR);
      return;
    }

    console.log('Processing options validated successfully');

    setIsLoading(true);
    startProcessingModal(t('message.processingImages', { count: selectedImagesForProcessing.length }));

    try {
      updateProcessingModal(10, t('processing.preparing'));

      const processingConfig = getProcessingConfiguration(processingOptions);

      // USE THE LOGGING HELPER
      logProcessingAttempt(selectedImagesForProcessing, processingConfig, aiModelLoaded);

      updateProcessingModal(30, t('processing.processingImages'));

      let processedImages;
      try {
        console.log('Calling orchestrateCustomProcessing...');
        processedImages = await orchestrateCustomProcessing(
          selectedImagesForProcessing,
          processingConfig,
          aiModelLoaded
        );

        console.log('orchestrateCustomProcessing completed:', {
          totalResults: processedImages?.length || 0,
          successfulResults: processedImages?.filter(img => !img.error)?.length || 0,
          failedResults: processedImages?.filter(img => img.error)?.length || 0
        });

        if (!processedImages || processedImages.length === 0) {
          throw new Error('No images were processed - function returned empty array');
        }

        // Check for errors in processed images
        const failedImages = processedImages.filter(img => img.error);
        if (failedImages.length > 0) {
          console.warn('Some images failed to process:', failedImages);

          // If all images failed
          if (failedImages.length === processedImages.length) {
            throw new Error(`All images failed to process: ${failedImages[0]?.error || 'Unknown error'}`);
          }

          // Show warning about failed images
          const failedNames = failedImages.map(img => img.name).join(', ');
          console.warn(`Failed images: ${failedNames}`);

          // Show a warning modal about failed images
          setTimeout(() => {
            showModal(
              t('message.warning'),
              `${failedImages.length} image(s) failed to process: ${failedNames}`,
              MODAL_TYPES.WARNING
            );
          }, 2000);
        }

      } catch (processingError) {
        console.error('Error in orchestrateCustomProcessing:', {
          message: processingError.message,
          stack: processingError.stack,
          name: processingError.name,
          config: processingConfig,
          aiModelLoaded: aiModelLoaded
        });

        // USE THE ERROR HANDLING HELPER
        const errorInfo = handleProcessingError(processingError);
        console.log('Error analysis:', errorInfo);

        throw new Error(`${errorInfo.userMessage}: ${processingError.message}\n\nSuggestion: ${errorInfo.suggestion}`);
      }

      // Filter out only successful images
      const successfulImages = processedImages.filter(img => !img.error);
      console.log(`Successful images: ${successfulImages.length}/${processedImages.length}`);

      if (successfulImages.length === 0) {
        throw new Error('No images were successfully processed');
      }

      updateProcessingModal(70, t('processing.creatingZip'));
      console.log('Creating export zip...');

      const settings = generateExportSettings(EXPORT_SETTINGS.CUSTOM);
      console.log('Export settings:', settings);

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

        console.log('Zip created successfully, size:', formatFileSize(zipBlob.size));
      } catch (zipError) {
        console.error('Error creating zip:', zipError);
        throw new Error(`Failed to create zip file: ${zipError.message}`);
      }

      updateProcessingModal(90, t('processing.downloading'));
      console.log('Downloading zip...');

      try {
        downloadZip(zipBlob, EXPORT_SETTINGS.DEFAULT_ZIP_NAME_CUSTOM);
        console.log('Zip download initiated');
      } catch (downloadError) {
        console.error('Error downloading zip:', downloadError);
        // Don't throw here - we still want to show success even if auto-download fails
        // Show a warning instead
        setTimeout(() => {
          showModal(
            t('message.warning'),
            'Files were processed but auto-download failed. You can download them manually.',
            MODAL_TYPES.WARNING
          );
        }, 3000);
      }

      updateProcessingModal(100, t('processing.complete'));
      console.log('Processing completed successfully');

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

      console.log('Generated summary:', summary);

      // Close progress modal and show summary
      setTimeout(() => {
        closeModal();
        showSummaryModal(summary);
        console.log('Summary modal shown');
      }, 1000);

    } catch (error) {
      console.error('Error in processCustomImages:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // USE THE ERROR HANDLING HELPER HERE TOO
      const errorInfo = handleProcessingError(error);

      // Show error modal with helpful message
      showModal(
        t('message.error'),
        `${errorInfo.userMessage}\n\n${errorInfo.suggestion}`,
        MODAL_TYPES.ERROR
      );

      // If it's a retryable error, offer to try again
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
      console.log('=== PROCESSING COMPLETED ===');
      setIsLoading(false);

      // Cleanup
      setTimeout(() => {
        safeCleanupGPUMemory();
        console.log('GPU memory cleaned up');
      }, 500);
    }
  };

  /**
   * Logs detailed information about processing attempt
   */
  const logProcessingAttempt = (images, config, aiLoaded) => {
    console.group('Processing Attempt Details');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Number of images:', images.length);
    console.log('AI Model loaded:', aiLoaded);
    console.log('Processing configuration:', config);

    images.forEach((img, index) => {
      console.log(`Image ${index + 1}:`, {
        name: img.name,
        type: img.type,
        size: formatFileSize(img.size),
        dimensions: img.metadata?.dimensions || 'Unknown',
        hasTransparency: img.metadata?.hasTransparency || false,
        isTIFF: img.isTIFF,
        isSVG: img.isSVG
      });
    });

    console.groupEnd();
  };

  /**
   * Handle specific processing errors with better categorization
   */
  const handleProcessingError = (error) => {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    console.log('Analyzing error:', { errorMessage, errorStack });

    // AI/Model related errors
    if (errorMessage.includes('ai') || errorMessage.includes('model') ||
      errorMessage.includes('tensor') || errorMessage.includes('upscaler')) {
      return {
        userMessage: t('message.aiFailed'),
        suggestion: t('suggestion.tryStandardCrop'),
        shouldRetry: false,
        type: 'ai_error'
      };
    }

    // TIFF conversion errors
    if (errorMessage.includes('tiff') || errorMessage.includes('utif')) {
      return {
        userMessage: t('message.tiffConversionFailed'),
        suggestion: t('suggestion.convertTiffFirst'),
        shouldRetry: false,
        type: 'tiff_error'
      };
    }

    // SVG conversion errors
    if (errorMessage.includes('svg') || errorMessage.includes('vector')) {
      return {
        userMessage: t('message.svgConversionFailed'),
        suggestion: t('suggestion.checkSVG'),
        shouldRetry: false,
        type: 'svg_error'
      };
    }

    // Memory/GPU errors
    if (errorMessage.includes('memory') || errorMessage.includes('gpu') ||
      errorMessage.includes('texture') || errorMessage.includes('buffer')) {
      return {
        userMessage: t('message.memoryError'),
        suggestion: t('suggestion.reduceBatchSize'),
        shouldRetry: true,
        type: 'memory_error'
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out') ||
      errorMessage.includes('too long')) {
      return {
        userMessage: t('message.timeoutError'),
        suggestion: t('suggestion.trySmaller'),
        shouldRetry: true,
        type: 'timeout_error'
      };
    }

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch') ||
      errorMessage.includes('http') || errorMessage.includes('request')) {
      return {
        userMessage: 'Network error occurred',
        suggestion: 'Check your internet connection and try again.',
        shouldRetry: true,
        type: 'network_error'
      };
    }

    // File/IO errors
    if (errorMessage.includes('file') || errorMessage.includes('blob') ||
      errorMessage.includes('url') || errorMessage.includes('object')) {
      return {
        userMessage: 'File handling error',
        suggestion: 'Try uploading the images again or use different files.',
        shouldRetry: true,
        type: 'file_error'
      };
    }

    // Canvas/rendering errors
    if (errorMessage.includes('canvas') || errorMessage.includes('context') ||
      errorMessage.includes('draw') || errorMessage.includes('image')) {
      return {
        userMessage: 'Image rendering error',
        suggestion: 'Try with different images or reduce image size.',
        shouldRetry: true,
        type: 'canvas_error'
      };
    }

    // Default/generic error
    return {
      userMessage: t('message.errorProcessing'),
      suggestion: t('suggestion.tryAgain'),
      shouldRetry: true,
      type: 'generic_error'
    };
  };

  /**
   * Validate individual image files before processing
   */
  const validateImageFilesBeforeProcessing = (images) => {
    const issues = [];

    images.forEach((image, index) => {
      // Check file size (limit to 50MB per file)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (image.size > maxSize) {
        issues.push({
          image: image.name,
          issue: `File too large (${formatFileSize(image.size)}). Maximum size is 50MB.`,
          index
        });
      }

      // Check if file is corrupt/empty
      if (image.size === 0) {
        issues.push({
          image: image.name,
          issue: 'File appears to be empty (0 bytes).',
          index
        });
      }

      // Warn about TIFF files (they can be problematic)
      if (image.isTIFF) {
        console.warn(`TIFF file detected: ${image.name} - may have conversion issues`);
      }

      // Warn about SVG files
      if (image.isSVG) {
        console.warn(`SVG file detected: ${image.name} - may require special handling`);
      }
    });

    return issues;
  };

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

      const totalFiles = processedImages.length +
        (isFaviconSelected ? 9 : 0) +
        (isScreenshotSelected ? selectedScreenshotTemplates.length : 0) +
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
      showModal(t('message.error'), `${t('message.errorApplying')}: ${error.message}`, MODAL_TYPES.ERROR);
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

  const calculateCategoriesApplied = (selectedTemplates, templates, isFaviconSelected = false, isScreenshotSelected = false) => {
    const categories = new Set();

    if (selectedTemplates && selectedTemplates.length > 0) {
      selectedTemplates.forEach(templateId => {
        const template = templates.find(t => t.id === templateId);
        if (template && template.category) {
          let displayCategory = template.category;
          if (displayCategory === 'web' || displayCategory === 'logo' ||
            displayCategory === 'favicon' || displayCategory === 'screenshots') {
            categories.add(displayCategory);
          } else if (displayCategory === 'twitter') {
            categories.add('twitter/x');
          } else {
            categories.add(displayCategory);
          }
        }
      });
    }

    if (isFaviconSelected) {
      categories.add('favicon');
    }

    if (isScreenshotSelected) {
      categories.add('screenshots');
    }

    return categories.size;
  };

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
              processingOptions={processingOptions}
              t={t}
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
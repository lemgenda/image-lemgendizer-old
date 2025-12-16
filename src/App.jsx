import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ImageUploader from './components/ImageUploader'
import LanguageSwitcher from './components/LanguageSwitcher'
import Modal from './components/Modal'
import { createExportZip } from './utils/exportUtils'
import {
  processLemGendaryResize,
  processLemGendaryCrop,
  processLemGendaryRename,
  optimizeForWeb,
  checkImageTransparency,
  processSmartCrop
} from './utils/imageProcessor'
import { getTemplateCategories, SOCIAL_MEDIA_TEMPLATES, getTemplatesByCategory } from './utils/templateConfigs'
import RangeSlider from './components/RangeSlider'
import './styles/App.css'

// Import logos (assuming they're in src/assets/)
import lemGendaIcon from '../src/assets/lemgenda-icon.svg'
import lemGendaLogo from '../src/assets/lemgenda-logo.svg'

/**
 * Main App Component - Image LemGendizer
 * @component
 * @description Main application component for batch image processing and optimization
 * @returns {JSX.Element} Rendered application
 */
function App() {
  const { t, i18n } = useTranslation()
  const [images, setImages] = useState([])
  const [selectedImages, setSelectedImages] = useState([])
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [aiModelLoaded, setAiModelLoaded] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [processingOptions, setProcessingOptions] = useState({
    compression: {
      quality: 80,
      fileSize: ''
    },
    output: {
      format: 'webp',
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
  })

  const fileInputRef = useRef(null)

  /**
   * Get plural suffix for current language
   * @function
   * @param {number} count - Count for pluralization
   * @returns {string} Plural suffix
   */
  const getPluralSuffix = (count) => {
    const language = i18n.language
    if (language === 'hr') {
      // Croatian plural rules
      const lastDigit = count % 10
      const lastTwoDigits = count % 100

      if (lastDigit === 1 && lastTwoDigits !== 11) return 'a'
      if (lastDigit >= 2 && lastDigit <= 4 &&
        (lastTwoDigits < 10 || lastTwoDigits >= 20)) return 'e'
      return 'a'
    }

    // English plural rules
    return count === 1 ? '' : 's'
  }

  /**
   * Load AI model on component mount
   * @effect
   * @description Loads TensorFlow.js AI model for smart cropping functionality
   */
  useEffect(() => {
    const loadAIModel = async () => {
      if (processingOptions.cropMode === 'smart' && !aiModelLoaded) {
        try {
          setAiLoading(true)
          const { loadAIModel } = await import('./utils/imageProcessor')
          await loadAIModel()
          setAiModelLoaded(true)
          setAiLoading(false)
        } catch (error) {
          console.error('Failed to load AI model:', error)
          setAiLoading(false)
          showModal(t('message.error'), t('message.aiFailed'))
          setProcessingOptions(prev => ({ ...prev, cropMode: 'standard' }))
        }
      }
    }
    loadAIModel()
  }, [processingOptions.cropMode, t])

  /**
   * Handle image upload from file input or drag-and-drop
   * @function
   * @param {File[]} files - Array of uploaded image files
   * @description Processes uploaded files and adds them to the image list
   */
  const handleImageUpload = (files) => {
    const newImages = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
      optimized: false
    }))
    setImages([...images, ...newImages])

    // Auto-select all new images (for custom mode)
    if (processingOptions.processingMode === 'custom') {
      setSelectedImages([...selectedImages, ...newImages.map(img => img.id)])
    }

    if (processingOptions.processingMode === 'templates' && !processingOptions.templateSelectedImage && newImages.length > 0) {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: newImages[0].id
      }))
    }

    const suffix = getPluralSuffix(files.length)
    const message = t('message.successUpload', {
      count: files.length,
      s: i18n.language === 'en' ? (files.length === 1 ? '' : 's') : '',
      a: i18n.language === 'hr' ? suffix : '',
      e: i18n.language === 'hr' ? suffix : ''
    })
    showModal(t('message.success'), message)
  }

  /**
   * Handle image selection in gallery
   * @function
   * @param {string} imageId - Unique identifier of the image
   * @description Toggles image selection based on current processing mode
   */
  const handleImageSelect = (imageId) => {
    if (processingOptions.processingMode === 'templates') {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: imageId
      }))
      setSelectedImages([imageId])
    } else {
      setSelectedImages(prev =>
        prev.includes(imageId)
          ? prev.filter(id => id !== imageId)
          : [...prev, imageId]
      )
    }
  }

  /**
   * Select or deselect all images
   * @function
   * @description Toggles selection state of all uploaded images
   */
  const handleSelectAll = () => {
    if (processingOptions.processingMode === 'templates') {
      return
    }

    if (selectedImages.length === images.length) {
      setSelectedImages([])
    } else {
      setSelectedImages(images.map(img => img.id))
    }
  }

  /**
   * Remove selected images from the gallery
   * @function
   * @description Removes selected images based on current processing mode
   */
  const handleRemoveSelected = () => {
    const imagesToRemove = processingOptions.processingMode === 'templates'
      ? [processingOptions.templateSelectedImage].filter(Boolean)
      : selectedImages

    setImages(images.filter(img => !imagesToRemove.includes(img.id)))
    setSelectedImages([])

    if (processingOptions.processingMode === 'templates') {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: null
      }))
    }

    showModal(t('message.removed'), t('message.removedImages'))
  }

  /**
   * Display modal dialog
   * @function
   * @param {string} title - Modal title
   * @param {string} message - Modal message content
   * @description Shows a modal dialog with specified title and message
   */
  const showModal = (title, message) => {
    setModal({ isOpen: true, title, message })
  }

  /**
   * Close modal dialog
   * @function
   * @description Closes the currently open modal
   */
  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '' })
  }

  /**
   * Toggle between resize and crop modes
   * @function
   * @description Switches UI between resize and crop configuration sections
   */
  const toggleResizeCrop = () => {
    setProcessingOptions(prev => ({
      ...prev,
      showResize: !prev.showResize,
      showCrop: !prev.showCrop
    }))
  }

  /**
   * Toggle crop mode between standard and smart
   * @function
   * @description Switches between standard cropping and AI-powered smart cropping
   */
  const toggleCropMode = () => {
    setProcessingOptions(prev => ({
      ...prev,
      cropMode: prev.cropMode === 'smart' ? 'standard' : 'smart'
    }))
  }

  /**
   * Switch between custom processing and templates mode
   * @function
   * @param {string} mode - 'custom' or 'templates'
   * @description Changes the main processing mode of the application
   */
  const toggleProcessingMode = (mode) => {
    const newMode = mode === 'templates' ? 'templates' : 'custom'

    if (newMode === 'templates' && selectedImages.length > 1) {
      const firstSelected = selectedImages[0]
      setProcessingOptions(prev => ({
        ...prev,
        processingMode: newMode,
        templateSelectedImage: firstSelected,
        showTemplates: true
      }))
    } else {
      setProcessingOptions(prev => ({
        ...prev,
        processingMode: newMode,
        showTemplates: newMode === 'templates'
      }))
    }

    if (newMode !== 'templates') {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: null
      }))
    }
  }

  /**
   * Toggle selection of a specific template
   * @function
   * @param {string} templateId - Unique identifier of the template
   * @description Adds or removes a template from the selected templates list
   */
  const handleTemplateToggle = (templateId) => {
    setProcessingOptions(prev => {
      const newSelected = prev.selectedTemplates.includes(templateId)
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId]

      return { ...prev, selectedTemplates: newSelected }
    })
  }

  /**
   * Select all available templates
   * @function
   * @description Selects every template in the template library
   */
  const handleSelectAllTemplates = () => {
    const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id)
    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: allTemplateIds
    }))
  }

  /**
   * Select all templates in a specific category
   * @function
   * @param {string} category - Template category identifier
   * @description Selects all templates belonging to the specified category
   */
  const handleSelectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id)

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: [...new Set([...prev.selectedTemplates, ...categoryTemplates])]
    }))
  }

  /**
   * Deselect all templates in a specific category
   * @function
   * @param {string} category - Template category identifier
   * @description Deselects all templates belonging to the specified category
   */
  const handleDeselectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id)

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.filter(id => !categoryTemplates.includes(id))
    }))
  }

  /**
   * Update processing options
   * @function
   * @param {string} category - Option category ('compression', 'output', etc.)
   * @param {string} key - Option key within the category
   * @param {any} value - New option value
   * @description Updates a specific processing option value
   */
  const handleOptionChange = (category, key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  /**
   * Update single processing option
   * @function
   * @param {string} key - Option key to update
   * @param {any} value - New option value
   * @description Updates a top-level processing option
   */
  const handleSingleOptionChange = (key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  /**
   * Get currently selected images for processing
   * @function
   * @returns {Array} Array of selected image objects
   * @description Returns images selected based on current processing mode
   */
  const getSelectedImagesForProcessing = () => {
    if (processingOptions.processingMode === 'templates') {
      return processingOptions.templateSelectedImage
        ? images.filter(img => img.id === processingOptions.templateSelectedImage)
        : []
    } else {
      return images.filter(img => selectedImages.includes(img.id))
    }
  }

  /**
   * Process images using custom settings
   * @async
   * @function
   * @description Applies custom processing options to selected images
   */
  const processCustomImages = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing()
    if (selectedImagesForProcessing.length === 0) {
      showModal(t('message.error'), t('message.errorSelectImages'))
      return
    }

    setIsLoading(true)
    showModal(t('message.processingImages'), t('message.processingImages', { count: selectedImagesForProcessing.length }))

    try {
      const processedImages = []

      for (let i = 0; i < selectedImagesForProcessing.length; i++) {
        const image = selectedImagesForProcessing[i]
        let processedFile = image.file

        // Apply resize if dimension is set
        if (processingOptions.showResize && processingOptions.resizeDimension) {
          const resizeResults = await processLemGendaryResize(
            [image],
            parseInt(processingOptions.resizeDimension)
          )
          if (resizeResults.length > 0) {
            processedFile = resizeResults[0].resized
          }
        }

        // Apply crop if dimensions are set
        if (processingOptions.showCrop && processingOptions.cropWidth && processingOptions.cropHeight) {
          let cropResults

          if (processingOptions.cropMode === 'smart') {
            // Use AI smart crop
            if (aiLoading) {
              showModal(t('message.aiLoading'), t('message.aiLoading'))
              await new Promise(resolve => setTimeout(resolve, 1000))
            }

            if (aiModelLoaded) {
              processedFile = await processSmartCrop(
                processedFile,
                parseInt(processingOptions.cropWidth),
                parseInt(processingOptions.cropHeight)
              )
            } else {
              // Fallback to standard crop if AI not loaded
              cropResults = await processLemGendaryCrop(
                [{ ...image, file: processedFile }],
                parseInt(processingOptions.cropWidth),
                parseInt(processingOptions.cropHeight),
                processingOptions.cropPosition
              )
              if (cropResults.length > 0) {
                processedFile = cropResults[0].cropped
              }
            }
          } else {
            // Use standard crop with position
            cropResults = await processLemGendaryCrop(
              [{ ...image, file: processedFile }],
              parseInt(processingOptions.cropWidth),
              parseInt(processingOptions.cropHeight),
              processingOptions.cropPosition
            )
            if (cropResults.length > 0) {
              processedFile = cropResults[0].cropped
            }
          }
        }

        // Apply rename if enabled
        let finalName = image.name
        if (processingOptions.output.rename && processingOptions.output.newFileName) {
          const renameResults = await processLemGendaryRename(
            [{ ...image, file: processedFile }],
            processingOptions.output.newFileName
          )
          if (renameResults.length > 0) {
            processedFile = renameResults[0].renamed
            const extension = image.name.split('.').pop()
            finalName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}.${extension}`
          }
        }

        // Convert to output format if not 'original'
        if (processingOptions.output.format !== 'original') {
          const hasTransparency = await checkImageTransparency(processedFile)
          const targetFormat = processingOptions.output.format

          let finalFormat
          if (targetFormat === 'jpg' && hasTransparency) {
            finalFormat = 'png'
          } else {
            finalFormat = targetFormat
          }

          processedFile = await optimizeForWeb(
            processedFile,
            processingOptions.compression.quality / 100,
            finalFormat
          )

          finalName = finalName.replace(/\.[^/.]+$/, '') + '.' + finalFormat
        }

        processedImages.push({
          ...image,
          file: processedFile,
          name: finalName,
          processed: true,
          format: processingOptions.output.format === 'original'
            ? image.type.split('/')[1]
            : processingOptions.output.format
        })
      }

      // Create ZIP with custom processed images
      const settings = {
        includeOriginal: true,
        includeOptimized: true,
        includeWebImages: false,
        includeLogoImages: false,
        includeSocialMedia: false,
        createFolders: true
      }

      const zipBlob = await createExportZip(selectedImagesForProcessing, processedImages, settings, 'custom')
      downloadZip(zipBlob, 'custom-processed-images')

      closeModal()

    } catch (error) {
      console.error('Custom processing error:', error)
      showModal(t('message.error'), t('message.errorProcessing'))
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Process images using social media templates
   * @async
   * @function
   * @description Applies selected social media templates to an image
   */
  const processTemplates = async () => {
    const selectedImagesForProcessing = getSelectedImagesForProcessing()
    if (selectedImagesForProcessing.length === 0) {
      showModal(t('message.error'), t('message.errorSelectImage'))
      return
    }

    if (processingOptions.selectedTemplates.length === 0) {
      showModal(t('message.error'), t('message.errorSelectTemplate'))
      return
    }

    setIsLoading(true)
    showModal(t('message.processingImages'), t('message.processingImages', { count: processingOptions.selectedTemplates.length }))

    try {
      const selectedTemplates = SOCIAL_MEDIA_TEMPLATES.filter(template =>
        processingOptions.selectedTemplates.includes(template.id)
      )

      const processedImages = []
      const image = selectedImagesForProcessing[0]

      const isSVG = image.file.type === 'image/svg+xml'
      const hasTransparency = isSVG ? false : await checkImageTransparency(image.file)

      for (const template of selectedTemplates) {
        let processedFile = image.file

        // Apply template dimensions
        if (template.width && template.height) {
          if (template.height === 'auto') {
            const resizeResults = await processLemGendaryResize(
              [image],
              template.width
            )
            if (resizeResults.length > 0) {
              processedFile = resizeResults[0].resized
            }
          } else {
            // For templates, always use standard crop (not smart crop)
            const cropResults = await processLemGendaryCrop(
              [image],
              template.width,
              template.height,
              'center' // Templates use center crop
            )
            if (cropResults.length > 0) {
              processedFile = cropResults[0].cropped
            }
          }
        }

        if (isSVG) {
          const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp')
          const jpgPngFile = await optimizeForWeb(processedFile, 0.85, 'png')

          const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`

          const webpName = `${baseName}.webp`
          processedImages.push({
            ...image,
            file: webpFile,
            name: webpName,
            template: template,
            format: 'webp',
            processed: true
          })

          if (template.category === 'web' || template.category === 'logo') {
            const pngName = `${baseName}.png`
            processedImages.push({
              ...image,
              file: jpgPngFile,
              name: pngName,
              template: template,
              format: 'png',
              processed: true
            })
          } else {
            const jpgName = `${baseName}.jpg`
            const socialJpgFile = await optimizeForWeb(processedFile, 0.85, 'jpg')
            processedImages.push({
              ...image,
              file: socialJpgFile,
              name: jpgName,
              template: template,
              format: 'jpg',
              processed: true
            })
          }
        } else {
          const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp')
          const jpgPngFile = await optimizeForWeb(processedFile, 0.85, hasTransparency ? 'png' : 'jpg')

          const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`

          const webpName = `${baseName}.webp`
          processedImages.push({
            ...image,
            file: webpFile,
            name: webpName,
            template: template,
            format: 'webp',
            processed: true
          })

          if (template.category === 'web' || template.category === 'logo') {
            const jpgPngName = `${baseName}.${hasTransparency ? 'png' : 'jpg'}`
            processedImages.push({
              ...image,
              file: jpgPngFile,
              name: jpgPngName,
              template: template,
              format: hasTransparency ? 'png' : 'jpg',
              processed: true
            })
          } else {
            const jpgName = `${baseName}.jpg`
            const socialJpgFile = await optimizeForWeb(processedFile, 0.85, 'jpg')
            processedImages.push({
              ...image,
              file: socialJpgFile,
              name: jpgName,
              template: template,
              format: 'jpg',
              processed: true
            })
          }
        }
      }

      const settings = {
        includeOriginal: false,
        includeOptimized: false,
        includeWebImages: true,
        includeLogoImages: true,
        includeSocialMedia: true,
        createFolders: true
      }

      const zipBlob = await createExportZip([image], processedImages, settings, 'templates')
      downloadZip(zipBlob, 'template-images')

      closeModal()

    } catch (error) {
      console.error('Template processing error:', error)
      showModal(t('message.error'), t('message.errorApplying'))
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Download processed images as ZIP file
   * @function
   * @param {Blob} zipBlob - ZIP file blob
   * @param {string} prefix - File name prefix
   * @description Creates and triggers download of ZIP file containing processed images
   */
  const downloadZip = (zipBlob, prefix) => {
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}-${Date.now()}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    showModal(t('message.success'), t('message.successDownload'))
  }

  /**
   * Format template names for display using translations
   * @function
   * @param {string} name - Original template name
   * @returns {string} Formatted display name
   * @description Converts internal template names to user-friendly display names
   */
  const formatTemplateName = (name) => {
    return t(`template.${name}`) || name
  }

  /**
   * Increment number value
   * @function
   * @param {string} key - State key to update
   * @param {number} increment - Amount to increment by
   * @description Increases a numeric value by the specified increment
   */
  const incrementValue = (key, increment = 1) => {
    const currentValue = parseInt(processingOptions[key] || '0')
    const newValue = Math.max(1, currentValue + increment)
    handleSingleOptionChange(key, String(newValue))
  }

  /**
   * Decrement number value
   * @function
   * @param {string} key - State key to update
   * @param {number} decrement - Amount to decrement by
   * @description Decreases a numeric value by the specified decrement
   */
  const decrementValue = (key, decrement = 1) => {
    const currentValue = parseInt(processingOptions[key] || '1')
    const newValue = Math.max(1, currentValue - decrement)
    handleSingleOptionChange(key, String(newValue))
  }

  const selectedImagesForProcessing = getSelectedImagesForProcessing()
  const templateCategories = getTemplateCategories()

  return (
    <div className="app">
      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin fa-3x"></i>
            <p>{t('loading.preparing')}</p>
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
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="app-header-logo">
          <img
            src={lemGendaIcon}
            alt="LemGenda Icon"
            className="header-icon"
          />
          <div className="header-title">
            <h1>{t('app.title')}</h1>
            <p className="app-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="main-content">
        <div className="upload-section">
          <ImageUploader
            onUpload={handleImageUpload}
            fileInputRef={fileInputRef}
          />
        </div>

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
                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-compress"></i> {t('compression.title')}
                      </h3>
                      <div className="form-group">
                        <label className="form-label">{t('compression.quality')}</label>
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

                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-file-export"></i> {t('output.title')}
                      </h3>
                      <div className="form-group">
                        <label className="form-label">{t('output.format')}</label>
                        <select
                          className="select-field"
                          value={processingOptions.output.format}
                          onChange={(e) => handleOptionChange('output', 'format', e.target.value)}
                        >
                          <option value="webp">{t('output.format.webp')}</option>
                          <option value="jpg">{t('output.format.jpg')}</option>
                          <option value="png">{t('output.format.png')}</option>
                          <option value="original">{t('output.format.original')}</option>
                        </select>
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
                            <i className="fas fa-crop-alt"></i> {t('crop.title')}
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
                                    <i className="fas fa-brain"></i> {t('crop.switchToStandard')}
                                    {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-crop-alt"></i> {t('crop.switchToSmart')}
                                  </>
                                )}
                              </button>
                            </div>

                            {processingOptions.cropMode === 'smart' && (
                              <div className="alert alert-info mt-sm">
                                <i className="fas fa-info-circle"></i>
                                {t('crop.aiPowered')}
                                {!aiModelLoaded && !aiLoading && <span className="font-semibold">{t('crop.aiNeedsLoad')}</span>}
                              </div>
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

                          {processingOptions.cropMode === 'smart' && (
                            <div className="alert alert-info">
                              <i className="fas fa-lightbulb"></i>
                              <span>{t('crop.smartBest')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      className="btn btn-primary btn-lg"
                      disabled={selectedImagesForProcessing.length === 0 || isLoading || (processingOptions.cropMode === 'smart' && aiLoading)}
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
                          <i className="fas fa-download"></i> {t('button.process')} ({selectedImagesForProcessing.length})
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
                        )

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
                        )
                      })}
                    </div>

                    {/* Template Action Section */}
                    <div className="card">
                      <div className="card-header">
                        <div className="flex items-center gap-md">
                          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                            <i className="fas fa-image text-white text-xl"></i>
                          </div>
                          <div>
                            <h4 className="card-title mb-xs">{t('templates.imageForTemplates')}</h4>
                            <p className="text-muted">
                              {processingOptions.templateSelectedImage
                                ? images.find(img => img.id === processingOptions.templateSelectedImage)?.name
                                : t('templates.noImageSelected')
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted mb-xs">
                            <i className="fas fa-layer-group mr-xs"></i>
                            {processingOptions.selectedTemplates.length} {t('templates.selected')}
                          </div>
                          <div className="text-muted">
                            <i className="fas fa-file-export mr-xs"></i>
                            {processingOptions.selectedTemplates.length > 0
                              ? `${processingOptions.selectedTemplates.length * 2} ${t('templates.filesToGenerate')}`
                              : t('templates.selectTemplates')
                            }
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
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
                                  {processingOptions.selectedTemplates.length * 2}
                                </span>
                              )}
                            </>
                          )}
                        </button>

                        {processingOptions.selectedTemplates.length > 0 && (
                          <div className="alert alert-info mt-md">
                            <i className="fas fa-info-circle"></i>
                            <span>
                              {t('templates.eachGenerates')}
                            </span>
                          </div>
                        )}

                        {!processingOptions.templateSelectedImage && (
                          <div className="alert alert-warning mt-md">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>{t('templates.selectImage')}</span>
                          </div>
                        )}
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
                    : selectedImages.includes(image.id)

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
                        <span className="image-size">{(image.size / 1024).toFixed(2)} KB • {image.type.split('/')[1].toUpperCase()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-left">
          <div className="footer-logo-container">
            <p className="text-muted mb-xs">{t('footer.createdBy')}</p>
            <a
              href="https://lemgenda.hr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src={lemGendaLogo}
                alt="LemGenda Logo"
                className="footer-logo"
              />
            </a>
          </div>
        </div>

        <div className="footer-right">
          <div className="footer-text">
            <p className="text-muted">{t('app.version')} - {t('app.processClientSide')}</p>
            <p className="text-muted text-sm mt-xs">
              <i className="fas fa-shield-alt"></i> {t('app.imagesNeverLeave')}
            </p>
            <p className="text-muted text-sm mt-xs">
              <i className="fas fa-brain"></i> {t('footer.aiEnabled')}
            </p>
          </div>
        </div>
      </footer>

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        actions={
          <button className="btn btn-primary" onClick={closeModal}>
            {t('button.ok')}
          </button>
        }
      >
        <p>{modal.message}</p>
      </Modal>
    </div>
  )
}

export default App
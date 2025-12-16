import { useState, useRef, useEffect } from 'react'
import ImageUploader from './components/ImageUploader'
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
    cropMode: 'smart', // DEFAULT CHANGED TO 'smart'
    cropPosition: 'center'
  })

  const fileInputRef = useRef(null)

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
          // Dynamically import the AI processing module
          const { loadAIModel } = await import('./utils/imageProcessor')
          await loadAIModel()
          setAiModelLoaded(true)
          setAiLoading(false)
        } catch (error) {
          console.error('Failed to load AI model:', error)
          setAiLoading(false)
          showModal('AI Model', 'AI model could not be loaded. Using standard crop instead.')
          setProcessingOptions(prev => ({ ...prev, cropMode: 'standard' }))
        }
      }
    }
    loadAIModel()
  }, [processingOptions.cropMode])

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

    showModal('Success', `Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''}`)
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

    showModal('Removed', 'Selected images have been removed')
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
      showModal('Error', 'Please select images to process')
      return
    }

    setIsLoading(true)
    showModal('Processing', `Processing ${selectedImagesForProcessing.length} images...`)

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
              showModal('AI Loading', 'Please wait while AI model loads...')
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
      showModal('Error', 'Error processing images')
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
      showModal('Error', 'Please select an image for templates')
      return
    }

    if (processingOptions.selectedTemplates.length === 0) {
      showModal('Error', 'Please select at least one template')
      return
    }

    setIsLoading(true)
    showModal('Processing', `Applying ${processingOptions.selectedTemplates.length} templates...`)

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
      showModal('Error', 'Error applying templates')
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

    showModal('Success', 'ZIP file downloaded successfully! Check your downloads folder.')
  }

  /**
   * Format template names for display
   * @function
   * @param {string} name - Original template name
   * @returns {string} Formatted display name
   * @description Converts internal template names to user-friendly display names
   */
  const formatTemplateName = (name) => {
    const nameMap = {
      // Logo
      'LogoRectangular': 'Rectangular',
      'LogoSquare': 'Square',

      // Web
      'WebHero': 'Hero',
      'WebBlog': 'Blog Featured',
      'WebContent': 'Content',
      'WebThumb': 'Thumbnail',

      // Instagram
      'InstagramProfile': 'Profile',
      'InstagramSquare': 'Square',
      'InstagramPortrait': 'Portrait',
      'InstagramLandscape': 'Landscape',
      'InstagramStoriesReels': 'Stories & Reels',

      // Facebook
      'FacebookProfile': 'Profile',
      'FacebookCoverBanner': 'Cover',
      'FacebookSharedImage': 'Shared',
      'FacebookSquarePost': 'Square',
      'FacebookStories': 'Stories',

      // Twitter/X
      'XProfile': 'Profile',
      'XHeaderBanner': 'Header',
      'XLandscapePost': 'Landscape',
      'XSquarePost': 'Square',
      'XPortraitPost': 'Portrait',

      // LinkedIn
      'LinkedInProfile': 'Profile',
      'LinkedInPersonalCover': 'Cover',
      'LinkedInLandscapePost': 'Landscape',
      'LinkedInSquarePost': 'Square',
      'LinkedInPortraitPost': 'Portrait',

      // YouTube
      'YouTubeChannelIcon': 'Channel Icon',
      'YouTubeBanner': 'Banner',
      'YouTubeThumbnail': 'Thumbnail',

      // Pinterest
      'PinterestProfile': 'Profile',
      'PinterestStandardPin': 'Standard',
      'PinterestSquarePin': 'Square',
      'PinterestStoryPin': 'Story',

      // TikTok
      'TikTokProfile': 'Profile',
      'TikTokVideoCover': 'Video Cover'
    };

    return nameMap[name] || name;
  };

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
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-spinner fa-spin fa-3x"></i>
            <p>Preparing your ZIP file...</p>
          </div>
        </div>
      )}

      {/* AI Model Loading Overlay */}
      {aiLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">
            <i className="fas fa-brain fa-spin fa-3x"></i>
            <p>Loading AI model for smart cropping...</p>
            <p className="text-muted">This only happens once per session</p>
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
            <h1>Image LemGendizer</h1>
            <p className="app-subtitle">Batch Image Processing & Optimization Tool</p>
          </div>
        </div>
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
                  <i className="fas fa-sliders-h"></i> Processing Mode
                </h2>
                <div className="card-actions">
                  <button
                    className={`btn ${processingOptions.processingMode === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('custom')}
                  >
                    <i className="fas fa-sliders-h"></i> Custom Processing
                  </button>
                  <button
                    className={`btn ${processingOptions.processingMode === 'templates' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => toggleProcessingMode('templates')}
                  >
                    <i className="fas fa-th-large"></i> Templates
                  </button>
                </div>
              </div>

              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                {processingOptions.processingMode === 'templates'
                  ? 'Templates Mode: Select ONE image to apply templates'
                  : 'Custom Mode: Select MULTIPLE images for batch processing'
                }
              </div>

              {processingOptions.processingMode === 'custom' ? (
                <>
                  <div className="grid grid-cols-auto gap-lg mb-lg">
                    <div className="card">
                      <h3 className="card-title">
                        <i className="fas fa-compress"></i> Compression
                      </h3>
                      <div className="form-group">
                        <label className="form-label">Quality (1-100)</label>
                        <div className="range-wrapper">
                          <RangeSlider
                            label="Quality (1–100)"
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
                        <label className="form-label">Target File Size (KB, optional)</label>
                        <div className="number-input-wrapper">
                          <input
                            type="number"
                            className="input-field"
                            value={processingOptions.compression.fileSize}
                            onChange={(e) => handleOptionChange('compression', 'fileSize', e.target.value)}
                            placeholder="Leave empty for auto"
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
                        <i className="fas fa-file-export"></i> Output Settings
                      </h3>
                      <div className="form-group">
                        <label className="form-label">Output Format</label>
                        <select
                          className="select-field"
                          value={processingOptions.output.format}
                          onChange={(e) => handleOptionChange('output', 'format', e.target.value)}
                        >
                          <option value="webp">WebP (Recommended)</option>
                          <option value="jpg">JPEG</option>
                          <option value="png">PNG</option>
                          <option value="original">Keep Original</option>
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
                          <span>Batch Rename</span>
                        </label>
                      </div>
                      {processingOptions.output.rename && (
                        <div className="form-group">
                          <label className="form-label">New File Name</label>
                          <input
                            type="text"
                            className="input-field"
                            value={processingOptions.output.newFileName}
                            onChange={(e) => handleOptionChange('output', 'newFileName', e.target.value)}
                            placeholder="e.g., product-image"
                          />
                        </div>
                      )}
                    </div>

                    <div className="card">
                      <h3 className="card-title">
                        {processingOptions.showResize ? (
                          <>
                            <i className="fas fa-expand-alt"></i> Resize
                          </>
                        ) : (
                          <>
                            <i className="fas fa-crop-alt"></i> Crop
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
                              <i className="fas fa-crop"></i> Switch to Crop Mode
                            </>
                          ) : (
                            <>
                              <i className="fas fa-expand-alt"></i> Switch to Resize Mode
                            </>
                          )}
                        </button>
                      </div>

                      {processingOptions.showResize ? (
                        <div className="form-group">
                          <label className="form-label">Resize Dimension (px)</label>
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
                            For portrait: sets height. For landscape: sets width. Aspect ratio maintained.
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
                                    <i className="fas fa-brain"></i> Switch to Standard Crop
                                    {aiLoading && <i className="fas fa-spinner fa-spin ml-xs"></i>}
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-crop-alt"></i> Switch to Smart Crop
                                  </>
                                )}
                              </button>
                            </div>

                            {processingOptions.cropMode === 'smart' && (
                              <div className="alert alert-info mt-sm">
                                <i className="fas fa-info-circle"></i>
                                AI-powered: Detects main subject and crops intelligently
                                {!aiModelLoaded && !aiLoading && <span className="font-semibold"> (AI model needs to load)</span>}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-md">
                            <div className="form-group">
                              <label className="form-label">Crop Width (px)</label>
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
                              <label className="form-label">Crop Height (px)</label>
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
                              <label className="form-label">Crop Position</label>
                              <select
                                value={processingOptions.cropPosition}
                                onChange={(e) => handleSingleOptionChange('cropPosition', e.target.value)}
                                className="select-field"
                              >
                                <option value="center">Center</option>
                                <option value="top-left">Top Left</option>
                                <option value="top">Top</option>
                                <option value="top-right">Top Right</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="bottom">Bottom</option>
                                <option value="bottom-right">Bottom Right</option>
                              </select>
                              <p className="form-helper">
                                Image will be resized to fit dimensions, then cropped from selected position
                              </p>
                            </div>
                          )}

                          {processingOptions.cropMode === 'smart' && (
                            <div className="alert alert-info">
                              <i className="fas fa-lightbulb"></i>
                              <span>Smart crop works best with images containing clear subjects (people, objects, etc.)</span>
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
                          <i className="fas fa-spinner fa-spin"></i> Processing...
                        </>
                      ) : processingOptions.cropMode === 'smart' && aiLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Loading AI Model...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-download"></i> Download Custom Processed Images ({selectedImagesForProcessing.length})
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
                          <i className="fas fa-th-large"></i> Template Selection
                        </h3>
                        <p className="text-muted mt-xs">
                          <i className="fas fa-info-circle"></i>
                          Templates use center crop (not smart crop) for consistent sizing
                        </p>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={handleSelectAllTemplates}
                          disabled={!processingOptions.templateSelectedImage}
                        >
                          <i className="fas fa-check-square"></i> Select All Templates
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setProcessingOptions(prev => ({ ...prev, selectedTemplates: [] }))}
                          disabled={processingOptions.selectedTemplates.length === 0}
                        >
                          <i className="fas fa-times-circle"></i> Clear All
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
                                <i className={`${category.icon} mr-sm`}></i> {category.name}
                              </h4>
                              <div className="card-actions">
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSelectAllInCategory(category.id)}
                                  disabled={!processingOptions.templateSelectedImage}
                                >
                                  <i className="fas fa-check"></i> All
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleDeselectAllInCategory(category.id)}
                                  disabled={!processingOptions.templateSelectedImage}
                                >
                                  <i className="fas fa-times"></i> None
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
                            <h4 className="card-title mb-xs">Image for Templates</h4>
                            <p className="text-muted">
                              {processingOptions.templateSelectedImage
                                ? images.find(img => img.id === processingOptions.templateSelectedImage)?.name
                                : 'No image selected'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted mb-xs">
                            <i className="fas fa-layer-group mr-xs"></i>
                            {processingOptions.selectedTemplates.length} templates selected
                          </div>
                          <div className="text-muted">
                            <i className="fas fa-file-export mr-xs"></i>
                            {processingOptions.selectedTemplates.length > 0
                              ? `${processingOptions.selectedTemplates.length * 2} files to generate`
                              : 'Select templates to generate files'
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
                              <i className="fas fa-spinner fa-spin"></i> Processing Templates...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-file-archive"></i> Download Template Images
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
                              Each template generates WebP + {images.find(img => img.id === processingOptions.templateSelectedImage)?.file.type === 'image/svg+xml' ? 'PNG/JPG' : 'PNG/JPG (based on transparency)'}
                            </span>
                          </div>
                        )}

                        {!processingOptions.templateSelectedImage && (
                          <div className="alert alert-warning mt-md">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>Please select an image from the gallery above to apply templates</span>
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
                  <i className="fas fa-images"></i> Uploaded Images ({images.length})
                  {processingOptions.processingMode === 'templates' && (
                    <span className="text-muted font-normal ml-md">
                      (Templates mode: Click ONE image to select)
                    </span>
                  )}
                </h3>
                <div className="card-actions">
                  {processingOptions.processingMode === 'custom' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleSelectAll}
                    >
                      <i className="fas fa-check-square"></i> {selectedImages.length === images.length ? 'Deselect All' : 'Select All'}
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
                    <i className="fas fa-trash"></i> Remove Selected
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
                          <i className="fas fa-th-large mr-1"></i> TEMPLATE IMAGE
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
            <p className="text-muted mb-xs">Created by</p>
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
            <p className="text-muted">Image LemGendizer v2.0.0 - All processing is done client-side</p>
            <p className="text-muted text-sm mt-xs">
              <i className="fas fa-shield-alt"></i> Your images never leave your browser
              <span className="text-info ml-sm"> • <i className="fas fa-brain"></i> AI Smart Crop enabled</span>
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
            OK
          </button>
        }
      >
        <p>{modal.message}</p>
      </Modal>
    </div>
  )
}

export default App
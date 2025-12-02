import { useState, useRef } from 'react'
import ImageUploader from './components/ImageUploader'
import Modal from './components/Modal'
import { createExportZip } from './utils/exportUtils'
import {
  processLemGendaryResize,
  processLemGendaryCrop,
  processLemGendaryRename,
  optimizeForWeb,
  checkImageTransparency
} from './utils/imageProcessor'
import { getTemplateCategories, SOCIAL_MEDIA_TEMPLATES, getTemplatesByCategory } from './utils/templateConfigs'
import './styles/App.css'

// Import logos (assuming they're in src/assets/)
import lemGendaIcon from './assets/lemgenda-icon.svg'
import lemGendaLogo from './assets/lemgenda-logo.svg'

function App() {
  const [images, setImages] = useState([])
  const [selectedImages, setSelectedImages] = useState([])
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' })
  const [isLoading, setIsLoading] = useState(false)
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
    templateSelectedImage: null
  })

  const fileInputRef = useRef(null)

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

    if (processingOptions.processingMode === 'templates' && !processingOptions.templateSelectedImage && newImages.length > 0) {
      setProcessingOptions(prev => ({
        ...prev,
        templateSelectedImage: newImages[0].id
      }))
    }

    showModal('Success', `Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''}`)
  }

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

  const showModal = (title, message) => {
    setModal({ isOpen: true, title, message })
  }

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '' })
  }

  const toggleResizeCrop = () => {
    setProcessingOptions(prev => ({
      ...prev,
      showResize: !prev.showResize,
      showCrop: !prev.showCrop
    }))
  }

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

  const handleTemplateToggle = (templateId) => {
    setProcessingOptions(prev => {
      const newSelected = prev.selectedTemplates.includes(templateId)
        ? prev.selectedTemplates.filter(id => id !== templateId)
        : [...prev.selectedTemplates, templateId]

      return { ...prev, selectedTemplates: newSelected }
    })
  }

  const handleSelectAllTemplates = () => {
    const allTemplateIds = SOCIAL_MEDIA_TEMPLATES.map(template => template.id)
    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: allTemplateIds
    }))
  }

  const handleSelectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id)

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: [...new Set([...prev.selectedTemplates, ...categoryTemplates])]
    }))
  }

  const handleDeselectAllInCategory = (category) => {
    const categoryTemplates = SOCIAL_MEDIA_TEMPLATES
      .filter(template => template.category === category)
      .map(template => template.id)

    setProcessingOptions(prev => ({
      ...prev,
      selectedTemplates: prev.selectedTemplates.filter(id => !categoryTemplates.includes(id))
    }))
  }

  const handleOptionChange = (category, key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }))
  }

  const handleSingleOptionChange = (key, value) => {
    setProcessingOptions(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const getSelectedImagesForProcessing = () => {
    if (processingOptions.processingMode === 'templates') {
      return processingOptions.templateSelectedImage
        ? images.filter(img => img.id === processingOptions.templateSelectedImage)
        : []
    } else {
      return images.filter(img => selectedImages.includes(img.id))
    }
  }

  // Helper function to check image transparency
  const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
      if (file.type !== 'image/png') {
        resolve(false)
        return
      }

      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Check alpha channel
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            resolve(true)
            return
          }
        }
        resolve(false)
      }
      img.onerror = () => resolve(false)
      img.src = URL.createObjectURL(file)
    })
  }

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
          const cropResults = await processLemGendaryCrop(
            [{ ...image, file: processedFile }],
            parseInt(processingOptions.cropWidth),
            parseInt(processingOptions.cropHeight)
          )
          if (cropResults.length > 0) {
            processedFile = cropResults[0].cropped
          }
        }

        // Apply rename if enabled - FIXED: Use sequence number
        let finalName = image.name
        if (processingOptions.output.rename && processingOptions.output.newFileName) {
          const renameResults = await processLemGendaryRename(
            [{ ...image, file: processedFile }],
            processingOptions.output.newFileName
          )
          if (renameResults.length > 0) {
            processedFile = renameResults[0].renamed
            // Ensure sequence number is correct
            const extension = image.name.split('.').pop()
            finalName = `${processingOptions.output.newFileName}-${String(i + 1).padStart(2, '0')}.${extension}`
          }
        }

        // Convert to output format if not 'original'
        if (processingOptions.output.format !== 'original') {
          const hasTransparency = await checkImageTransparency(processedFile)
          const targetFormat = processingOptions.output.format

          // Determine final format based on transparency and user selection
          let finalFormat
          if (targetFormat === 'jpg' && hasTransparency) {
            finalFormat = 'png' // PNG with transparency can't be converted to JPG
          } else {
            finalFormat = targetFormat
          }

          // Convert to the final format
          processedFile = await optimizeForWeb(
            processedFile,
            processingOptions.compression.quality / 100,
            finalFormat
          )

          // Update filename with correct extension
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

      // Check if image is SVG
      const isSVG = image.file.type === 'image/svg+xml'

      // Check if image has transparency (for raster images only)
      const hasTransparency = isSVG ? false : await checkImageTransparency(image.file)

      // Process image for each selected template
      for (const template of selectedTemplates) {
        let processedFile = image.file

        // Apply template dimensions
        if (template.width && template.height) {
          if (template.height === 'auto') {
            // Resize to width (ContentImage template)
            const resizeResults = await processLemGendaryResize(
              [image],
              template.width
            )
            if (resizeResults.length > 0) {
              processedFile = resizeResults[0].resized
            }
          } else {
            // Crop to exact dimensions
            const cropResults = await processLemGendaryCrop(
              [image],
              template.width,
              template.height
            )
            if (cropResults.length > 0) {
              processedFile = cropResults[0].cropped
            }
          }
        }

        // For SVG files, we need to handle WebP and JPEG/PNG conversion differently
        if (isSVG) {
          // Create WebP version (convert SVG to PNG first, then to WebP)
          const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp')

          // Create JPEG/PNG version
          const jpgPngFile = await optimizeForWeb(
            processedFile,
            0.85,
            'png' // SVGs convert better to PNG for transparency
          )

          // Rename with template name
          const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`

          // Add WebP version
          const webpName = `${baseName}.webp`
          processedImages.push({
            ...image,
            file: webpFile,
            name: webpName,
            template: template,
            format: 'webp',
            processed: true
          })

          // Add PNG version (for WebImages and LogoImages only)
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
            // Social media gets JPEG for SVGs too
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
          // Original raster image processing
          // Create WebP version
          const webpFile = await optimizeForWeb(processedFile, 0.8, 'webp')

          // Create JPEG/PNG version based on template category
          const jpgPngFile = await optimizeForWeb(
            processedFile,
            0.85,
            hasTransparency ? 'png' : 'jpg'
          )

          // Rename with template name
          const baseName = `${template.platform}-${template.name}-${image.name.replace(/\.[^/.]+$/, '')}`

          // Add WebP version
          const webpName = `${baseName}.webp`
          processedImages.push({
            ...image,
            file: webpFile,
            name: webpName,
            template: template,
            format: 'webp',
            processed: true
          })

          // Add JPEG/PNG version (for WebImages and LogoImages only)
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
            // Social media only gets JPEG
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

      // Create ZIP with template images
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

  const selectedImagesForProcessing = getSelectedImagesForProcessing()

  // Get template categories for display
  const templateCategories = getTemplateCategories()

  // Function to format template names for display
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
  }

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
            <div className="processing-options">
              <div className="options-header">
                <h2>
                  <i className="fas fa-sliders-h"></i> Processing Mode
                </h2>
                <div className="controls-row">
                  <button
                    className={`btn ${processingOptions.processingMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleProcessingMode('custom')}
                  >
                    <i className="fas fa-sliders-h"></i> Custom Processing
                  </button>
                  <button
                    className={`btn ${processingOptions.processingMode === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => toggleProcessingMode('templates')}
                  >
                    <i className="fas fa-th-large"></i> Templates
                  </button>
                </div>
              </div>

              <div className="mode-info">
                <p>
                  <i className={`fas fa-${processingOptions.processingMode === 'templates' ? 'info-circle' : 'images'}`}></i>
                  {processingOptions.processingMode === 'templates'
                    ? 'Templates Mode: Select ONE image to apply templates'
                    : 'Custom Mode: Select MULTIPLE images for batch processing'
                  }
                </p>
              </div>

              {processingOptions.processingMode === 'custom' ? (
                <>
                  <div className="options-grid">
                    <div className="option-group">
                      <h3>
                        <i className="fas fa-compress"></i> Compression
                      </h3>
                      <div className="form-group">
                        <label>Quality (1-100)</label>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={processingOptions.compression.quality}
                          onChange={(e) => handleOptionChange('compression', 'quality', parseInt(e.target.value))}
                        />
                        <div className="range-value">{processingOptions.compression.quality}%</div>
                      </div>
                      <div className="form-group">
                        <label>Target File Size (KB, optional)</label>
                        <input
                          type="number"
                          value={processingOptions.compression.fileSize}
                          onChange={(e) => handleOptionChange('compression', 'fileSize', e.target.value)}
                          placeholder="Leave empty for auto"
                          min="1"
                        />
                      </div>
                    </div>

                    <div className="option-group">
                      <h3>
                        <i className="fas fa-file-export"></i> Output Settings
                      </h3>
                      <div className="form-group">
                        <label>Output Format</label>
                        <select
                          value={processingOptions.output.format}
                          onChange={(e) => handleOptionChange('output', 'format', e.target.value)}
                        >
                          <option value="webp">WebP (Recommended)</option>
                          <option value="jpg">JPEG</option>
                          <option value="png">PNG</option>
                          <option value="original">Keep Original</option>
                        </select>
                      </div>
                      <div className="checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={processingOptions.output.rename}
                            onChange={(e) => handleOptionChange('output', 'rename', e.target.checked)}
                          />
                          <i className="fas fa-font"></i> Batch Rename
                        </label>
                      </div>
                      {processingOptions.output.rename && (
                        <div className="form-group">
                          <label>New File Name</label>
                          <input
                            type="text"
                            value={processingOptions.output.newFileName}
                            onChange={(e) => handleOptionChange('output', 'newFileName', e.target.value)}
                            placeholder="e.g., product-image"
                          />
                        </div>
                      )}
                    </div>

                    <div className="option-group">
                      <h3>
                        <i className="fas fa-crop-alt"></i> Resize & Crop
                      </h3>
                      <div style={{ marginBottom: '15px' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={toggleResizeCrop}
                          style={{ width: '100%', marginBottom: '10px' }}
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
                          <label>Resize Dimension (px)</label>
                          <input
                            type="number"
                            value={processingOptions.resizeDimension}
                            onChange={(e) => handleSingleOptionChange('resizeDimension', e.target.value)}
                            placeholder="e.g., 1080"
                            min="1"
                          />
                          <small style={{ color: '#94a3b8', marginTop: '5px', display: 'block' }}>
                            For portrait: sets height. For landscape: sets width. Aspect ratio maintained.
                          </small>
                        </div>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>Crop Width (px)</label>
                            <input
                              type="number"
                              value={processingOptions.cropWidth}
                              onChange={(e) => handleSingleOptionChange('cropWidth', e.target.value)}
                              placeholder="Width"
                              min="1"
                            />
                          </div>
                          <div className="form-group">
                            <label>Crop Height (px)</label>
                            <input
                              type="number"
                              value={processingOptions.cropHeight}
                              onChange={(e) => handleSingleOptionChange('cropHeight', e.target.value)}
                              placeholder="Height"
                              min="1"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                      className="btn btn-primary btn-large"
                      disabled={selectedImagesForProcessing.length === 0 || isLoading}
                      onClick={processCustomImages}
                    >
                      {isLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Processing...
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
                  <div className="templates-section">
                    <div className="template-selection-header">
                      <div>
                        <h3>
                          <i className="fas fa-th-large"></i> Template Selection
                        </h3>
                      </div>
                      <div className="controls-row">
                        <button
                          className="btn btn-secondary"
                          onClick={handleSelectAllTemplates}
                          disabled={!processingOptions.templateSelectedImage}
                        >
                          <i className="fas fa-check-square"></i> Select All Templates
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setProcessingOptions(prev => ({ ...prev, selectedTemplates: [] }))}
                          disabled={processingOptions.selectedTemplates.length === 0}
                        >
                          <i className="fas fa-times-circle"></i> Clear All
                        </button>
                      </div>
                    </div>

                    <div className="templates-grid">
                      {templateCategories.map((category) => {
                        const categoryTemplates = SOCIAL_MEDIA_TEMPLATES.filter(template =>
                          template.category === category.id
                        )

                        return (
                          <div key={category.id} className="template-category">
                            <div className="template-category-header">
                              <h3 className="template-category-title">
                                <i className={`${category.icon} category-icon`}></i> {category.name}
                              </h3>
                              <div className="template-category-controls">
                                <button
                                  className="btn btn-secondary btn-small"
                                  onClick={() => handleSelectAllInCategory(category.id)}
                                  disabled={!processingOptions.templateSelectedImage}
                                >
                                  <i className="fas fa-check"></i> All
                                </button>
                                <button
                                  className="btn btn-secondary btn-small"
                                  onClick={() => handleDeselectAllInCategory(category.id)}
                                  disabled={!processingOptions.templateSelectedImage}
                                >
                                  <i className="fas fa-times"></i> None
                                </button>
                              </div>
                            </div>
                            <div className="template-options">
                              {categoryTemplates.map(template => (
                                <label key={template.id} className="checkbox-label" htmlFor={`template-${template.id}`}>
                                  <input
                                    id={`template-${template.id}`}
                                    type="checkbox"
                                    checked={processingOptions.selectedTemplates.includes(template.id)}
                                    onChange={() => handleTemplateToggle(template.id)}
                                    disabled={!processingOptions.templateSelectedImage}
                                  />
                                  <span className="template-info">
                                    <i className={`${template.icon} template-icon`}></i>
                                    <span className="template-details">
                                      <span className="template-name">{formatTemplateName(template.name)}</span>
                                      <span className="template-meta">
                                        <span className="template-dimensions">
                                          <i className="fas fa-expand-alt"></i>
                                          {template.width}×{template.height === 'auto' ? 'auto' : template.height}
                                        </span>
                                        <span className="template-platform">
                                          {category.id === 'instagram' && <i className="fab fa-instagram platform-instagram"></i>}
                                          {category.id === 'facebook' && <i className="fab fa-facebook platform-facebook"></i>}
                                          {category.id === 'twitter' && <i className="fab fa-twitter platform-twitter"></i>}
                                          {category.id === 'linkedin' && <i className="fab fa-linkedin platform-linkedin"></i>}
                                          {category.id === 'youtube' && <i className="fab fa-youtube platform-youtube"></i>}
                                          {category.id === 'pinterest' && <i className="fab fa-pinterest platform-pinterest"></i>}
                                          {category.id === 'tiktok' && <i className="fab fa-tiktok platform-tiktok"></i>}
                                          {category.id === 'web' && <i className="fas fa-globe platform-web"></i>}
                                          {category.id === 'logo' && <i className="fas fa-copyright platform-logo"></i>}
                                          {template.platform}
                                        </span>
                                      </span>
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Template Action Section */}
                    <div className="template-action-section">
                      <div className="template-action-header">
                        <div className="template-image-info">
                          <div className="template-image-icon">
                            <i className="fas fa-image"></i>
                          </div>
                          <div className="template-image-details">
                            <h4>Image for Templates</h4>
                            <p>
                              {processingOptions.templateSelectedImage
                                ? images.find(img => img.id === processingOptions.templateSelectedImage)?.name
                                : 'No image selected'
                              }
                            </p>
                          </div>
                        </div>
                        <div className="template-stats">
                          <div className="template-status">
                            <i className="fas fa-layer-group"></i>
                            <span>{processingOptions.selectedTemplates.length} templates selected</span>
                          </div>
                          <div className="template-file-count">
                            <i className="fas fa-file-export"></i>
                            <span>
                              {processingOptions.selectedTemplates.length > 0
                                ? `${processingOptions.selectedTemplates.length * 2} files to generate`
                                : 'Select templates to generate files'
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-primary btn-large template-download-btn"
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
                                <span className="file-count-badge">
                                  {processingOptions.selectedTemplates.length * 2} files
                                </span>
                              )}
                            </>
                          )}
                        </button>

                        {processingOptions.selectedTemplates.length > 0 && (
                          <div className="template-warning" style={{ marginTop: '15px', justifyContent: 'center' }}>
                            <i className="fas fa-info-circle"></i>
                            <span>
                              Each template generates WebP + {images.find(img => img.id === processingOptions.templateSelectedImage)?.file.type === 'image/svg+xml' ? 'PNG/JPG' : 'PNG/JPG (based on transparency)'}
                            </span>
                          </div>
                        )}

                        {!processingOptions.templateSelectedImage && (
                          <div className="template-warning" style={{ marginTop: '15px', justifyContent: 'center' }}>
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
            <div className="image-list-section">
              <div className="image-list-header">
                <h3>
                  <i className="fas fa-images"></i> Uploaded Images ({images.length})
                  {processingOptions.processingMode === 'templates' && (
                    <span className="template-mode-hint">
                      (Templates mode: Click ONE image to select)
                    </span>
                  )}
                </h3>
                <div className="image-list-actions">
                  {processingOptions.processingMode === 'custom' && (
                    <button
                      className="btn btn-secondary"
                      onClick={handleSelectAll}
                    >
                      <i className="fas fa-check-square"></i> {selectedImages.length === images.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                  <button
                    className="btn btn-danger"
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
                      className={`image-card ${isSelected ? 'selected' : ''} ${processingOptions.processingMode === 'templates' ? 'template-mode' : ''}`}
                      onClick={() => handleImageSelect(image.id)}
                    >
                      <div className="image-checkbox">
                        <i className={`fas fa-${isSelected ? 'check-circle' : 'circle'}`}></i>
                      </div>
                      {processingOptions.processingMode === 'templates' && isSelected && (
                        <div className="template-badge">
                          <i className="fas fa-th-large"></i> TEMPLATE IMAGE
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
        <div>
          <div className="footer-logo-container">
            <p className="footer-logo-label">Created by</p>
            <a
              href="https://lemgenda.hr"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block' }}
            >
              <img
                src={lemGendaLogo}
                alt="LemGenda Logo"
                className="footer-logo"
              />
            </a>
          </div>

          <div className="footer-text">
            <p>Image LemGendizer v1.0.0 - All processing is done client-side</p>
            <p className="footer-note">
              <i className="fas fa-shield-alt"></i> Your images never leave your browser
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
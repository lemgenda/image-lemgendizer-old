// LemGendary Resize: For portrait orientation image height gets set to entered value,
// and for landscape width gets set, image keeps aspect ratio
export const processLemGendaryResize = async (images, dimension) => {
    const results = []

    for (const image of images) {
        try {
            // Check if it's SVG
            if (image.file.type === 'image/svg+xml') {
                // For SVG, we need to process it differently
                const img = new Image()
                const svgUrl = URL.createObjectURL(image.file)

                await new Promise((resolve, reject) => {
                    img.onload = resolve
                    img.onerror = reject
                    img.src = svgUrl
                })

                let newWidth, newHeight

                // Determine orientation
                if (img.width >= img.height) {
                    // Landscape or square
                    newWidth = dimension
                    newHeight = Math.round((img.height / img.width) * dimension)
                } else {
                    // Portrait
                    newHeight = dimension
                    newWidth = Math.round((img.width / img.height) * dimension)
                }

                // Process SVG resize
                const resizedSVG = await processSVGResize(image.file, newWidth, newHeight)

                results.push({
                    original: image,
                    resized: resizedSVG,
                    dimensions: { width: newWidth, height: newHeight },
                    isSVG: true
                })

                URL.revokeObjectURL(svgUrl)
                continue
            }

            // Original raster image processing
            const img = await createImageBitmap(image.file)
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            let newWidth, newHeight

            // Determine orientation
            if (img.width >= img.height) {
                // Landscape or square
                newWidth = dimension
                newHeight = Math.round((img.height / img.width) * dimension)
            } else {
                // Portrait
                newHeight = dimension
                newWidth = Math.round((img.width / img.height) * dimension)
            }

            canvas.width = newWidth
            canvas.height = newHeight

            ctx.drawImage(img, 0, 0, newWidth, newHeight)

            const resizedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.85)
            })

            results.push({
                original: image,
                resized: new File([resizedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' }),
                dimensions: { width: newWidth, height: newHeight },
                isSVG: false
            })
        } catch (error) {
            console.error(`Error resizing ${image.name}:`, error)
        }
    }

    return results
}

// LemGendary Crop: User enters width and height, resize is done on the image,
// then other dimension is cropped towards middle
export const processLemGendaryCrop = async (images, width, height) => {
    const results = []

    for (const image of images) {
        try {
            // Check if it's SVG
            if (image.file.type === 'image/svg+xml') {
                // For SVG crop, we'll resize to fit then convert to raster for cropping
                const img = new Image()
                const svgUrl = URL.createObjectURL(image.file)

                await new Promise((resolve, reject) => {
                    img.onload = resolve
                    img.onerror = reject
                    img.src = svgUrl
                })

                // For SVG, we'll convert to raster first, then crop
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)

                // Now crop the raster version
                // First, resize while maintaining aspect ratio
                const scale = Math.max(width / img.width, height / img.height)
                const scaledWidth = img.width * scale
                const scaledHeight = img.height * scale

                // Create temporary canvas for resizing
                const tempCanvas = document.createElement('canvas')
                const tempCtx = tempCanvas.getContext('2d')
                tempCanvas.width = scaledWidth
                tempCanvas.height = scaledHeight
                tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

                // Now crop from center
                const cropCanvas = document.createElement('canvas')
                const cropCtx = cropCanvas.getContext('2d')
                cropCanvas.width = width
                cropCanvas.height = height

                const offsetX = (scaledWidth - width) / 2
                const offsetY = (scaledHeight - height) / 2

                cropCtx.drawImage(
                    tempCanvas,
                    offsetX, offsetY, width, height,
                    0, 0, width, height
                )

                const croppedBlob = await new Promise(resolve => {
                    cropCanvas.toBlob(resolve, 'image/png', 0.85)
                })

                results.push({
                    original: image,
                    cropped: new File([croppedBlob], image.name.replace(/\.svg$/i, '.png'), { type: 'image/png' }),
                    dimensions: { width, height },
                    isSVG: true
                })

                URL.revokeObjectURL(svgUrl)
                continue
            }

            // Original raster image processing
            const img = await createImageBitmap(image.file)
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            // First, resize while maintaining aspect ratio
            const scale = Math.max(width / img.width, height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale

            // Create temporary canvas for resizing
            const tempCanvas = document.createElement('canvas')
            const tempCtx = tempCanvas.getContext('2d')
            tempCanvas.width = scaledWidth
            tempCanvas.height = scaledHeight
            tempCtx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

            // Now crop from center
            canvas.width = width
            canvas.height = height

            const offsetX = (scaledWidth - width) / 2
            const offsetY = (scaledHeight - height) / 2

            ctx.drawImage(
                tempCanvas,
                offsetX, offsetY, width, height,
                0, 0, width, height
            )

            const croppedBlob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/webp', 0.85)
            })

            results.push({
                original: image,
                cropped: new File([croppedBlob], image.name.replace(/\.[^/.]+$/, '.webp'), { type: 'image/webp' }),
                dimensions: { width, height },
                isSVG: false
            })
        } catch (error) {
            console.error(`Error cropping ${image.name}:`, error)
        }
    }

    return results
}

// LemGendary Rename: Batch rename functionality, user enters newFileName
// and optimized images get renamedImageName that is newFileName-##,
// if nothing is inputed renamedImageName is originalFileName
export const processLemGendaryRename = async (images, baseName) => {
    return images.map((image, index) => {
        const extension = image.name.split('.').pop()
        const newName = baseName
            ? `${baseName}-${String(index + 1).padStart(2, '0')}.${extension}`
            : image.name

        return {
            original: image,
            renamed: new File([image.file], newName, { type: image.type }),
            newName
        }
    })
}

// SVG-specific processing functions
export const processSVGResize = async (svgFile, width, height) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async (e) => {
            try {
                const svgText = e.target.result

                // Parse SVG to update dimensions
                let updatedSVG = svgText

                // Try to update width and height attributes
                updatedSVG = updatedSVG.replace(
                    /width="([^"]*)"/,
                    `width="${width}"`
                )
                updatedSVG = updatedSVG.replace(
                    /height="([^"]*)"/,
                    `height="${height}"`
                )

                // Also update viewBox if it exists
                if (updatedSVG.includes('viewBox')) {
                    updatedSVG = updatedSVG.replace(
                        /viewBox="([^"]*)"/,
                        `viewBox="0 0 ${width} ${height}"`
                    )
                } else {
                    // Add viewBox if it doesn't exist
                    updatedSVG = updatedSVG.replace(
                        /<svg([^>]*)>/,
                        `<svg$1 viewBox="0 0 ${width} ${height}">`
                    )
                }

                const blob = new Blob([updatedSVG], { type: 'image/svg+xml' })
                const fileName = svgFile.name.replace(/\.svg$/i, `-${width}x${height}.svg`)
                resolve(new File([blob], fileName, { type: 'image/svg+xml' }))
            } catch (error) {
                reject(error)
            }
        }
        reader.onerror = reject
        reader.readAsText(svgFile)
    })
}

export const convertSVGToRaster = async (svgFile, width, height, format = 'png') => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const reader = new FileReader()

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')

                // Fill background with white for JPG conversion
                if (format === 'jpg' || format === 'jpeg') {
                    ctx.fillStyle = '#ffffff'
                    ctx.fillRect(0, 0, canvas.width, canvas.height)
                }

                ctx.drawImage(img, 0, 0, width, height)

                // Determine MIME type
                let mimeType, extension
                switch (format) {
                    case 'jpg':
                    case 'jpeg':
                        mimeType = 'image/jpeg'
                        extension = 'jpg'
                        break
                    case 'png':
                        mimeType = 'image/png'
                        extension = 'png'
                        break
                    case 'webp':
                        mimeType = 'image/webp'
                        extension = 'webp'
                        break
                    default:
                        mimeType = 'image/png'
                        extension = 'png'
                }

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to create blob'))
                            return
                        }

                        const fileName = svgFile.name.replace(/\.svg$/i, `-${width}x${height}.${extension}`)
                        resolve(new File([blob], fileName, { type: mimeType }))
                    },
                    mimeType,
                    0.9
                )
            }

            img.onerror = reject
            img.src = e.target.result
        }

        reader.onerror = reject
        reader.readAsDataURL(svgFile)
    })
}

// Optimize images for web, convert to specified format
export const optimizeForWeb = async (imageFile, quality = 0.8, format = 'webp') => {
    // Check if it's an SVG file
    if (imageFile.type === 'image/svg+xml') {
        // For SVG files, we can't convert to raster formats directly
        // Return the SVG as-is for webp, or convert to PNG for other formats
        if (format === 'webp') {
            // Can't convert SVG to WebP directly, convert to PNG first
            return convertSVGToRaster(imageFile, 1000, 1000, 'png')
        } else {
            return convertSVGToRaster(imageFile, 1000, 1000, format)
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height

            const ctx = canvas.getContext('2d')

            // Fill background with white for JPG conversion to avoid black/transparent background issues
            if (format === 'jpg' || format === 'jpeg') {
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
            }

            // Draw the image
            ctx.drawImage(img, 0, 0)

            // Determine MIME type and extension based on format
            let mimeType, extension
            switch (format.toLowerCase()) {
                case 'jpg':
                case 'jpeg':
                    mimeType = 'image/jpeg'
                    extension = 'jpg'
                    break
                case 'png':
                    mimeType = 'image/png'
                    extension = 'png'
                    break
                case 'webp':
                    mimeType = 'image/webp'
                    extension = 'webp'
                    break
                default:
                    mimeType = 'image/webp'
                    extension = 'webp'
            }

            // Convert to specified format
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob'))
                        return
                    }

                    // Get original name without extension
                    const originalName = imageFile.name.replace(/\.[^/.]+$/, '')
                    const newName = `${originalName}.${extension}`
                    resolve(new File([blob], newName, { type: mimeType }))
                },
                mimeType,
                quality
            )
        }

        img.onerror = (err) => {
            console.error('Image load error:', err)
            reject(new Error('Failed to load image'))
        }

        img.src = URL.createObjectURL(imageFile)

        // Clean up the object URL after image loads
        setTimeout(() => {
            if (img.src) {
                URL.revokeObjectURL(img.src)
            }
        }, 1000)
    })
}

// Check image transparency
export const checkImageTransparency = async (file) => {
    return new Promise((resolve) => {
        // SVG files don't have transparency in the same way as PNG
        if (file.type === 'image/svg+xml') {
            // Check if SVG might have transparent elements
            const reader = new FileReader()
            reader.onload = (e) => {
                const svgText = e.target.result
                // Check for transparent fills or opacity
                const hasTransparency = svgText.includes('fill="none"') ||
                    svgText.includes('opacity=') ||
                    svgText.includes('fill-opacity') ||
                    svgText.includes('rgba(') ||
                    svgText.includes('fill:#00000000')
                resolve(hasTransparency)
            }
            reader.onerror = () => resolve(false)
            reader.readAsText(file)
        } else if (file.type !== 'image/png') {
            resolve(false)
        } else {
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
        }
    })
}

// Helper function to convert image to data URL (for previews)
export const imageToDataURL = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// Helper function to get image dimensions
export const getImageDimensions = (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height,
                orientation: img.width >= img.height ? 'landscape' : 'portrait'
            })
        }
        img.onerror = reject
        img.src = URL.createObjectURL(file)

        // Clean up
        setTimeout(() => URL.revokeObjectURL(img.src), 1000)
    })
}
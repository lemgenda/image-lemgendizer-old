Image LemGendizer
=================

A modern, accessible, and production-ready web application for batch image processing and optimization. Process images for web and social media templates directly in your browser with AI superpowers.


[https://img.shields.io/npm/v/@lemgenda/image-lemgendizer](https://img.shields.io/npm/v/@lemgenda/image-lemgendizer)
[https://img.shields.io/npm/l/@lemgenda/image-lemgendizer](https://img.shields.io/npm/l/@lemgenda/image-lemgendizer)
[https://img.shields.io/bundlephobia/minzip/@lemgenda/image-lemgendizer](https://img.shields.io/bundlephobia/minzip/@lemgenda/image-lemgendizer)

🚀 Live Demo
------------

Visit: [**https://lemgenda.github.io/image-lemgendizer-old/**](https://lemgenda.github.io/image-lemgendizer-old/)

✨ Features
----------

### 🖼️ **Image Processing**

*   **Batch Processing**: Upload and process multiple images at once

*   **Smart Templates**: Pre-defined templates for all social media platforms (Instagram, Facebook, Twitter, LinkedIn, etc.)

*   **AI Image Restoration**: Advanced FP32 absolute restoration suite (Standardized high-precision)
    *   **Dehazing**: Specialized Indoor (FFA-Net) and Outdoor models
    *   **Deraining**: Effective rain removal using MPRNet
    *   **Low-Light Enhancement**: Professional visibility boost with MIRNetV2 (Fixed color-tint artifacts)
    *   **Deblurring & Denoising**: State-of-the-art NAFNet models
*   **AI Upscaling**: High-fidelity FP32 upscaling with ESRGAN models (2x, 3x, 4x)

*   **Image Filters**: 20+ professional filters including Vintage, HDR, Night Vision, and creative presets
*   **Real-time Preview**: Live filter preview before processing

*   **TIFF Support**: Comprehensive TIFF file processing with UTIF library


### 🛠️ **Format & Optimization**

*   **Format Conversion**: Convert to WebP, JPEG, PNG, AVIF with transparency support

*   **Smart Compression**: Adjustable quality settings with file size optimization

*   **Resize & Crop**: Multiple resizing options with intelligent aspect ratio preservation

*   **Auto-Upscaling**: Automatically upscale images when needed for target dimensions


### 🌐 **Web Features**

*   **Client-Side Processing**: Your images never leave your browser - 100% privacy

*   **ZIP Export**: Download all processed images in organized folders

*   **Internationalization**: Full synchronization between English and Croatian with deep pluralization support and automatic language detection

*   **PWA Support**: Installable web app with full offline capabilities

*   **Responsive Design**: Works perfectly on desktop, tablet, and mobile
*   **Accessibility First**: Fully WCAG compliant with high-contrast Dark Mode and screen reader support



### 🎯 **Advanced Features**

*   **SVG Processing**: SVG to raster conversion with aspect ratio preservation

*   **Legacy Format Support**: TIFF, BMP, ICO format conversion

*   **Memory Management**: Intelligent GPU memory cleanup and monitoring

*   **Performance Optimized**: Code splitting and efficient resource usage


📋 ToDo
-------

*   Split functionalities into modular npm packages

*   Create npm package for core image processing

*   Add more AI models for different use cases

*   Implement cloud sync capabilities


🚀 Quick Start
--------------

### Prerequisites

*   **Node.js 20+** (Required for dependencies)

*   **npm 10+** or **yarn 1.22+**


### Local Development

```
# Clone the repository
git clone https://github.com/lemgenda/image-lemgendizer-old.git
cd image-lemgendizer-old


# Install dependencies
npm install


# Start development server (port 5173)
npm run dev


# Build for production
npm run build


# Preview production build
npm run preview


# Deploy to GitHub Pages
npm run deploy

```

### GitHub Pages Deployment

The project includes automated GitHub Actions workflow that:

*   Automatically builds on push to main branch

*   Deploys to GitHub Pages

*   Uses Node.js 20 for compatibility

*   Includes npm caching for faster builds


🏗️ Project Structure
---------------------

```
src/
├── App.tsx
├── main.tsx
├── i18n.ts
├── setupTests.ts
├── assets/
├── components/           # UI Components
│   ├── AdvancedRenameTab.jsx
│   ├── CustomProcessingTab.jsx
│   ├── TemplateImageSection.jsx
│   ├── TemplateSelectionCard.jsx
│   ├── ...
├── configs/              # Configuration files
│   └── templateConfigs.ts
├── constants/            # Application constants
│   ├── imageConstants.ts
│   ├── themeConstants.ts
│   └── ...
├── context/              # React Context providers
│   └── ProcessingContext.tsx
├── helpers/              # Helper functions
│   └── i18nHelpers.ts
├── hooks/                # Custom React hooks
├── styles/               # CSS and styling
│   ├── App.css
│   ├── TemplateImageSection.css
│   ├── TabPanel.css
│   └── ...
├── utils/                # Utility functions
│   ├── fileUtils.ts
│   ├── renameUtils.ts
│   ├── generalUtils.ts
│   └── ...
├── processors/           # Core processing logic
│   ├── imageProcessor.ts
│   ├── exportProcessor.ts
│   └── ...
├── workers/              # Web Workers
│   └── sharpen.worker.ts
└── __tests__/            # Tests
    ├── ui-integration/
    └── ...
```

🛠️ Technologies
----------------

### Core

*   **TypeScript** - Strictly typed for reliability

*   **React 19** - UI library

*   **Vite 7** - Build tool and dev server

*   **TensorFlow.js** - AI-powered image processing

*   **ESRGANSlim** - AI upscaling models


### Image Processing

*   **Canvas API** - Browser-based image manipulation

*   **UTIF** - TIFF file processing

*   **JSZip** - ZIP file creation


### UI & Styling

*   **Font Awesome** - Icons

*   **CSS Variables** - Modern styling system

*   **i18next** - Internationalization


### Deployment

*   **GitHub Actions** - CI/CD pipeline

*   **GitHub Pages** - Hosting

*   **Node.js 20+** - Required runtime


🔧 Configuration
----------------

### Environment

The project requires **Node.js 20+** as specified in package.json:

```
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```
### Build Optimization

The Vite configuration includes:

*   TensorFlow.js optimization

*   Manual chunk splitting for better loading

*   Base path configuration for GitHub Pages


📁 Supported Formats
--------------------

### Input Formats

*   **Common**: JPEG, PNG, WebP, GIF, SVG

*   **Legacy**: TIFF, BMP, ICO

*   **Modern**: AVIF


### Output Formats

*   WebP (recommended)

*   JPEG

*   PNG

*   AVIF (browser support dependent)


🧠 AI Features
--------------

### Smart Cropping

*   Uses TensorFlow.js COCO-SSD model for object detection

*   Automatically identifies main subjects (people, animals, objects)

*   Intelligent positioning based on subject location


### AI Upscaling

*   ESRGAN-based upscaling models (2x, 3x, 4x)

*   Fallback to enhanced bicubic interpolation

*   Tiled processing for large images


🌐 Browser Support
------------------

*   Chrome 88+

*   Firefox 85+

*   Safari 14+

*   Edge 88+


**Note**: AVIF support requires Chrome 85+, Firefox 93+, or Edge 93+

🤝 Contributing
---------------

1.  Fork the repository

2.  Create a feature branch (git checkout -b feature/amazing-feature)

3.  Commit changes (git commit -m 'Add amazing feature')

4.  Push to branch (git push origin feature/amazing-feature)

5.  Open a Pull Request


### Development Guidelines

*   Follow existing code style and structure

*   Add comprehensive comments for new functionality

*   Update documentation and changelog

*   Test changes across different browsers


📄 License
----------

This project is licensed under the MIT License - see the [LICENSE](https://license/) file for details.

🙏 Acknowledgments
------------------

*   [TensorFlow.js](https://www.tensorflow.org/js) for AI capabilities

*   [UpscalerJS](https://github.com/thekevinscott/upscalerjs) for ESRGAN models

*   [UTIF.js](https://github.com/photopea/UTIF.js) for TIFF processing

*   [Vite](https://vitejs.dev/) for excellent build tooling


📞 Support
----------

*   **Issues**: [GitHub Issues](https://github.com/lemgenda/image-lemgendizer-old/issues)

*   **Documentation**: [Changelog](https://changelog.md/)


📊 Project Status
-----------------

**Version**: 3.8.0
**Last Updated**: February 2026
**Active Development**: Yes
**Production Ready**: Yes

Built with ❤️ by [Lem Treursić](https://github.com/lemgenda)
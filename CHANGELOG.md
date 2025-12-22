Changelog
=========

All notable changes to the Image LemGendizer project will be documented in this file.

\[2.4.0\] - 2025-12-22
----------------------

### Major Changes

*   **Node.js Compatibility**: Updated project to require Node.js 20+ for better compatibility

*   **GitHub Actions**: Fixed CI/CD pipeline for automatic deployment to GitHub Pages

*   **Dependency Updates**: Updated critical dependencies to versions requiring Node.js 20+


### Features

*   **GitHub Pages Deployment**: Automated deployment workflow for main branch pushes

*   **Node.js 20 Support**: Full compatibility with modern Node.js features

*   **Enhanced Build Process**: Optimized Vite build configuration for better performance

*   **Engine Specification**: Added engines field to package.json for clear version requirements


### Dependency Updates

*   **@vitejs/plugin-react**: ^5.1.2 (requires Node.js ^20.19.0 || >=22.12.0)

*   **vite**: ^7.3.0 (requires Node.js ^20.19.0 || >=22.12.0)

*   **@fortawesome/react-fontawesome**: ^3.1.1 (requires Node.js >=20)

*   **utif**: ^3.1.0 (added for TIFF processing support)


### CI/CD Improvements

*   **GitHub Actions**: Updated deploy.yml to use Node.js 20 instead of 18

*   **Cache Optimization**: Added npm caching for faster CI builds

*   **Build Artifacts**: Proper handling of build artifacts for GitHub Pages

*   **Automatic Deployment**: Push to main triggers automatic build and deploy


### Fixed Files

*   deploy.yml: Updated Node.js version from 18 to 20

*   package.json: Added engines field specifying Node.js >=20

*   vite.config.js: Optimized TensorFlow.js loading and build output

*   package-lock.json: Regenerated with Node.js 20 compatibility


### Bug Fixes

*   Fixed npm ci errors due to Node.js version mismatch

*   Resolved package-lock.json synchronization issues

*   Fixed TIFF processing with added utif library support

*   Improved memory management in image processing


### Technical Improvements

*   Added .nvmrc file for consistent Node.js version management

*   Enhanced build optimization with manual chunk splitting

*   Improved GPU memory management for AI upscaling

*   Better error handling for unsupported image formats


### Performance

*   Reduced bundle size by optimizing dependencies

*   Improved loading times with better code splitting

*   Enhanced memory cleanup during batch processing

*   Better handling of large images with tiled processing


\[2.3.0\] - 2025-12-21
----------------------

### Features

*   **TIFF Support**: Added comprehensive TIFF file processing with UTIF library

*   **AI Upscaling Memory Management**: Enhanced memory cleanup and monitoring

*   **SVG Processing**: Improved SVG to raster conversion with aspect ratio preservation


### Technical Improvements

*   **Memory Optimization**: Added GPU memory monitoring and cleanup

*   **File Validation**: Enhanced file format detection and validation

*   **Error Recovery**: Better error handling for corrupted or unsupported files

*   **Performance**: Optimized image loading with timeout handling


\[2.2.0\] - 2025-12-20
----------------------

### Features

*   **Advanced AI Cropping**: Enhanced smart crop with TensorFlow.js object detection

*   **Upscaling Improvements**: Better AI upscaling with ESRGAN models

*   **Format Optimization**: Improved WebP, AVIF, and PNG compression

*   **SVG Support**: Basic SVG processing and conversion


### Technical Improvements

*   **Code Splitting**: Added manual chunks for better loading performance

*   **Dependency Optimization**: Better tree-shaking and bundle optimization

*   **Memory Management**: Improved cleanup of blob URLs and canvas elements


\[2.1.0\] - 2025-12-16
----------------------

### Major Changes

*   **Internationalization Support**: Added full i18n support with react-i18next

*   **Multi-language UI**: English and Croatian language support

*   **Language Detection**: Automatic detection of browser language

*   **Language Persistence**: User's language choice saved in localStorage


### Features

*   **Language Switcher**: Easy toggle between English and Croatian

*   **Pluralization Support**: Proper handling of singular/plural forms in both languages

*   **Complete Translation**: All UI elements translated

*   **Template Name Translation**: Social media template names localized

*   **Dynamic Plural Rules**: Language-specific pluralization rules


### New Files Added

*   src/i18n.js: i18next configuration with translation resources

*   src/helpers/i18nHelpers.js: Helper functions for pluralization rules

*   Updated package.json with new dependencies


### Dependencies Added

*   i18next: Core i18n library

*   react-i18next: React bindings for i18next

*   i18next-browser-languagedetector: Automatic language detection


### Component Updates

*   **App.jsx**: Added language switcher, integrated useTranslation hook

*   **ImageUploader.jsx**: Replaced hardcoded strings with translations

*   **Modal.jsx**: Added translation support

*   **Main entry file**: Import i18n configuration


### CSS Updates

*   Added language switcher styling

*   Improved responsive design for language buttons


### Bug Fixes

*   Fixed pluralization in success messages

*   Improved accessibility with proper ARIA labels for language switcher

*   Fixed template name display in non-English languages


### Translation Coverage

*   ✅ App titles and headers

*   ✅ Upload section and buttons

*   ✅ Processing mode selection

*   ✅ Compression settings

*   ✅ Output settings

*   ✅ Resize and crop controls

*   ✅ Template selection interface

*   ✅ Image gallery

*   ✅ Modal dialogs

*   ✅ Success/error messages

*   ✅ Loading states

*   ✅ Footer information

*   ✅ Template categories and names

*   ✅ Pluralized messages


### Technical Improvements

*   Centralized translation management

*   Easy-to-extend translation system

*   Component-level translation support

*   Clean separation of UI and content


\[2.0.0\] - 2025-12-15
----------------------

### Major Changes

*   **Complete CSS Rewrite**: Standardized styling system with CSS variables

*   **No Gradients**: Removed all gradient backgrounds for cleaner, modern look

*   **Responsive Design**: Improved mobile and tablet responsiveness

*   **AI Integration**: Added TensorFlow.js for smarter image processing


### Features

*   **Standardized Form Controls**: All inputs, selects, checkboxes use consistent styling

*   **CSS Variables**: Centralized color system and spacing variables

*   **Icon System**: Standardized icon sizing and spacing utilities

*   **Accessibility**: Improved contrast ratios and focus states

*   **Performance**: Optimized CSS file size and loading


### CSS Improvements

*   Added comprehensive CSS variable system for colors, spacing, and typography

*   Standardized button styling with multiple variants (primary, secondary, danger, outline)

*   Fixed slider styling with better thumb design and hover effects

*   Fixed crop mode button layout for mobile devices

*   Added responsive grid system with utility classes

*   Standardized alert/notification system with info, warning, success, and error variants


### Component Updates

*   **ImageUploader**: Better drop zone styling and icon sizing

*   **Modal**: Standardized modal styling with backdrop blur

*   **App**: Updated to use new CSS classes throughout


### Bug Fixes

*   Fixed icon sizing issues in text paragraphs

*   Fixed crop mode buttons overflowing on smaller screens

*   Fixed slider thumb styling and hover effects

*   Fixed mobile layout issues with card headers and button groups

*   Fixed template badge positioning


### Technical Improvements

*   Added comprehensive JSDoc comments throughout codebase

*   Consolidated and standardized CSS classes

*   Removed duplicate styles and optimized CSS

*   Added proper vendor prefixes for better browser compatibility


### Dependencies

*   Updated TensorFlow.js integration for smarter AI cropping

*   Enhanced SVG processing capabilities

*   Improved WebP conversion quality


\[1.1.0\] - 2025-12-01
----------------------

### Added

*   Initial release with basic image processing features

*   Social media template system

*   Batch processing capabilities

*   ZIP export functionality


### Fixed

*   Basic responsive design

*   Image format detection

*   File size optimization
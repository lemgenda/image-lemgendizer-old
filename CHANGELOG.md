Changelog
=========

All notable changes to the Image LemGendizer project will be documented in this file.

[3.0.0] - 2026-01-04
----------------------

### Major Changes

*   **Version 3.0.0 Release**: Reached major milestone for production release.
*   **Comprehensive Code Cleanup**: Removed all debug logging (`console.log`) and cleaned up source code comments/emojis for a professional codebase.
*   **Integration Test Stability**: Resolved all integration test failures in `ResizeFlow`, `TemplateProcessingFlow`, and `FaviconsFlow`, ensuring 100% test pass rate.
*   **Production Verification**: Validated full build pipeline, linting compliance, and type safety.

[2.9.0] - 2026-01-04
----------------------

### Major Changes

*   **Integrated Batch Rename**: Custom Processing now fully supports advanced batch rename patterns (Find/Replace, Casing, Tokens) directly, sharing logic with the Batch Rename tab.
*   **CSS Refactoring**: Extracted component styles (e.g., `TemplateImageSection`) into modular CSS files for better maintainability.
*   **Project Cleanup**:
    *   Removed unused helper files and temporary logs (`lint-results.txt`, `*.log`).
    *   Removed `console.log` and `console.warn` statements from utility and processor files for a cleaner production build.
    *   Updated `README.md` with current file structure and feature set.

### Features

*   **Advanced Renaming in Custom Mode**: Users can now apply complex rename patterns (e.g., `{name}-{counter}` with specific casing or replacements) when processing custom images.
*   **Legacy Rename Support**: Automatic fallback for simple rename patterns (appending `{counter}` if usage is ambiguous) to prevent file overwrites.

### Technical Improvements

*   **Unit Tests**: Added dedicated unit tests for `orchestrateCustomProcessing` to verify renaming logic.
*   **Documentation**: Updated JSDocs and ensured consistency in utility functions.
*   **CI/CD**: Verified linting and build processes for the new version.

[2.8.1] - 2026-01-04
----------------------

### Major Changes

*   **Accessibility & Theming Overhaul**:
    *   Achieved **WCAG AA/AAA Compliance** for color contrast in both Light and Dark themes.
    *   Dark mode now uses high-contrast text on buttons (dark text on light buttons) for superior readability.
    *   Fixed incorrect button text colors (white text on light backgrounds in some cases).
    *   Added proper `aria-labels` and `id` associations for all form inputs (sliders, drop zones, url inputs).
    *   Fixed invisible tab text in Dark Mode by standardizing `TabPanel` CSS variables.
*   **Production Cleanup**:
    *   Removed all debug console logs (`console.log`, `console.warn`) for a clean production console.
    *   Resolved all remaining ESLint errors (including `no-empty` blocks).
    *   Cleaned up temporary log files and build artifacts.
*   **Bug Fixes**:
    *   Fixed `createExportZip` function to correctly handle translations (passed `t` function properly).
    *   Fixed screenshot filenames to be properly translated instead of hardcoded english fallbacks.

[2.8.0] - 2026-01-03
----------------------

### Major Changes

*   **Production Readiness**: Completed full production readiness audit and remediation.
*   **Performance Optimization**:
    *   Optimized AI upscaling with non-blocking async data transfer.
    *   Implemented Web Worker for image sharpening to prevent UI freezing.
    *   Optimized bundle size with manual chunks and dev-dependency cleanup.
*   **UI Stability**: Fixed all UI integration tests and refined test matchers.
*   **Proxy Server Improvements**: Cleaned up proxy server logs and error handling.

### Features

*   **Non-Blocking AI**: User interface remains responsive during heavy AI operations.
*   **Optimized Bundle**: Faster initial load times due to better code splitting.
*   **Enhanced Stability**: Robust error handling in proxy server and tests.

### Technical Improvements

*   **HTMLImageElement Mock**: Added robust mocking for JSDOM image handling.
*   **Dependency Cleanup**: Moved `canvas` to devDependencies.
*   **Code Cleanup**: Removed debugging logs and standardized logging.
*   **Test Suite**: All tests (Unit, Integration, UI) are passing stable.
*   **Documentation**: Complete JSDoc audit and standardization across all processors and utilities.

[2.7.0] - 2026-01-02
----------------------

### Major Changes

*   **Massive App.jsx Refactor**: Overhauled the core component to reduce complexity by ~33%.
*   **Modular Component Architecture**: Extracted monolithic UI into focused, reusable components.
*   **New Tabbed Navigation**: Introduced `TabPanel` for seamless switching between Custom and Template processing modes.
*   **Stability & Fixes**: Resolved critical post-integration `ReferenceError`s and standardized prop handling.

### Features

*   **Modular Processing Tabs**:
    *   `CustomProcessingTab`: Groups all custom output, quality, and resize/crop controls.
    *   `TemplateProcessingTab`: Manages social media templates, favicons, and screenshots.
*   **Refactored Components**:
    *   `FormatSelectionCard`: Modern format selection and file renaming logic.
    *   `QualityControlsCard`: Enhanced compression and target file size management.
    *   `ResizeCropCard`: Fully modular resize and smart crop configuration.
    *   `TemplateSelectionCard`: Streamlined template selection grid and platform categories.
*   **Enhanced Progress Feedback**: Global progress bar styles standardized across the app.

### Technical Improvements

*   **Code Reduction**: `App.jsx` reduced from 2041 to ~1365 lines.
*   **Prop Standardization**: Standardized `onScreenshotUrlChange` and other key handlers for better maintainability.
*   **Improved Helper Logic**: Restored and optimized `getTranslatedTemplateName` and `getTranslatedPlatformName` utility functions.
*   **JSDoc Documentation**: Comprehensive documentation added to all new modular components.

### Bug Fixes

*   **Fixed Layout Issues**: Corrected CSS for crop dropdowns and responsive card headers.
*   **Restored Missing Helpers**: Fixed `ReferenceError`s caused by missing helper functions after refactor.
*   **Prop Drilling Sync**: Synchronized screenshot URL handlers across the component hierarchy.
*   **Translation Integrity**: Ensured all platform and template names correctly utilize translation keys.

[2.6.0] - 2025-12-29
----------------------

### Major Changes

*   **Summary Statistics Fix**: Complete overhaul of processing summary to show accurate counts
*   **Template Count Accuracy**: Fixed template count calculation showing 0 instead of actual count
*   **File Count Correction**: Proper total file count calculation including all generated files
*   **Platform Name Translation**: Added translation support for folder and file names in exports

### Features

*   **Accurate Summary Statistics**: Processing summary now shows correct counts for:
    *   Templates Applied (15 instead of 0)
    *   Categories Applied (10 categories)
    *   Formats Exported (WEBP, PNG, JPG, ICO)
    *   Total Files (26 files instead of 14)
*   **Translated Export Folders**: Platform names in ZIP file folders now use translated names
*   **Comprehensive File Counting**: Includes all generated files in count (images, favicon set, manifest, readme, summary)
*   **Fixed Pluralization**: No duplicate count values in summary display

### Fixed Files

*   **templateProcessor.js**: Updated `calculateTotalTemplateFiles` function to properly count all template types
*   **exportProcessor.js**:
    *   Fixed `createExportSummary` function to include all formats and accurate counts
    *   Updated `organizeTemplatesByPlatform` to use translated platform names
    *   Fixed `calculateTotalFiles` to count all file types correctly
    *   Added translation parameter to `createExportZip` for localized folder names
*   **App.jsx**:
    *   Fixed template count calculation in `processTemplates` function
    *   Updated summary modal to show accurate counts without duplicates
    *   Pass translation function to `createExportZip` for translated exports
*   **i18n.js**: Added missing translations for summary statistics and platform names

### Bug Fixes

*   **Fixed Template Count**: No longer shows "0 0 templates applied" - now shows "15 templates applied"
*   **Fixed File Count**: No longer shows "14 14 files generated" - now shows "26 files generated"
*   **Fixed Format Display**: Now shows all formats (WEBP, PNG, JPG, ICO) instead of just WEBP, PNG, JPG
*   **Fixed Category Count**: Properly counts 10 categories instead of incorrect values
*   **Fixed Translation Support**: Platform names in export folders now use translated names
*   **Fixed Duplicate Values**: Summary modal no longer shows duplicate count values

### Technical Improvements

*   **Enhanced Summary Logic**: Improved counting logic for all file types
*   **Better Format Detection**: Proper detection and inclusion of ICO format for favicon sets
*   **Translation Integration**: Export system now supports translated folder and file names
*   **Accurate Statistics**: All counts in processing summary are now mathematically correct

### Performance

*   **Optimized File Counting**: More efficient counting of generated files
*   **Better Memory Management**: Improved cleanup during template processing
*   **Enhanced Export Performance**: Optimized ZIP creation with translated names

[2.5.0] - 2025-12-28
----------------------

### Major Changes

*   **Processing Summary Enhancement**: Added detailed processing summary modal with operation tracking
*   **AI Processing Indicators**: Added visual indicators for AI smart crop and upscaling usage
*   **Template Statistics**: Improved template processing statistics and reporting

### Features

*   **Comprehensive Summary Modal**: Shows detailed processing results including:
    *   Processing mode used
    *   Number of images processed
    *   Formats exported
    *   Total files generated
    *   AI processing usage
    *   Operations performed
*   **AI Usage Tracking**: Clear indication when AI smart crop or upscaling was used
*   **Template Statistics**: Shows number of templates applied and categories used
*   **Auto-close Summary**: Summary modal auto-closes after 5 seconds if not interacted with
*   **Enhanced User Feedback**: Better visual feedback during processing operations

### Fixed Files

*   **App.jsx**: Added summary modal with detailed processing information
*   **templateProcessor.js**: Enhanced processing summary creation with AI tracking
*   **exportProcessor.js**: Improved export summary generation
*   **sharedConstants.js**: Added new constants for summary display

### Bug Fixes

*   **Fixed Modal Timing**: Better auto-close timing for different modal types
*   **Improved Error Handling**: Better error recovery during template processing
*   **Fixed Memory Leaks**: Improved cleanup of processing resources
*   **Enhanced User Experience**: Smoother transitions between processing states

### Technical Improvements

*   **Summary Data Structure**: Enhanced data structure for processing summaries
*   **Modal Management**: Improved modal state management with auto-close functionality
*   **Operation Tracking**: Better tracking of processing operations for summary display
*   **Performance Metrics**: Added tracking of processing performance and resource usage

[2.4.0] - 2025-12-22
----------------------

### Major Changes

*   **Node.js Compatibility**: Updated project to require Node.js 20+ for better compatibility
*   **GitHub Actions**: Fixed CI/CD pipeline for automatic deployment to GitHub Pages
*   **Dependency Updates**: Updated critical dependencies to versions requiring Node.js 20+

### Features

*   **GitHub Pages Deployment**: Automated deployment workflow for main branch pushes
*   **Node.js 20 Support**: Full compatibility with modern Node.js features
*   **Enhanced Build Process**: Optimized Vite build configuration for better performance
*   **Engine Specification**: Added `engines` field to package.json for clear version requirements

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
*   package.json: Added `engines` field specifying Node.js >=20
*   vite.config.js: Optimized TensorFlow.js loading and build output
*   package-lock.json: Regenerated with Node.js 20 compatibility

### Bug Fixes

*   Fixed `npm ci` errors due to Node.js version mismatch
*   Resolved package-lock.json synchronization issues
*   Fixed TIFF processing with added utif library support
*   Improved memory management in image processing

### Technical Improvements

*   Added `.nvmrc` file for consistent Node.js version management
*   Enhanced build optimization with manual chunk splitting
*   Improved GPU memory management for AI upscaling
*   Better error handling for unsupported image formats

### Performance

*   Reduced bundle size by optimizing dependencies
*   Improved loading times with better code splitting
*   Enhanced memory cleanup during batch processing
*   Better handling of large images with tiled processing

[2.3.0] - 2025-12-21
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

[2.2.0] - 2025-12-20
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

[2.1.0] - 2025-12-16
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
*   Updated `package.json` with new dependencies

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

[2.0.0] - 2025-12-15
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

[1.1.0] - 2025-12-01
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
# Changelog

All notable changes to the Image LemGendizer project will be documented in this file.

## [2.1.0] - 2025-12-16

### Major Changes
- **Internationalization Support**: Added full i18n support with react-i18next
- **Multi-language UI**: English and Croatian language support
- **Language Detection**: Automatic detection of browser language
- **Language Persistence**: User's language choice saved in localStorage

### Features
- **Language Switcher**: Easy toggle between English and Croatian
- **Pluralization Support**: Proper handling of singular/plural forms in both languages
- **Complete Translation**: All UI elements translated
- **Template Name Translation**: Social media template names localized
- **Dynamic Plural Rules**: Language-specific pluralization rules

### New Files Added
- `src/i18n.js`: i18next configuration with translation resources
- `src/helpers/i18nHelpers.js`: Helper functions for pluralization rules
- Updated `package.json` with new dependencies

### Dependencies Added
- `i18next`: Core i18n library
- `react-i18next`: React bindings for i18next
- `i18next-browser-languagedetector`: Automatic language detection

### Component Updates
- **App.jsx**: Added language switcher, integrated useTranslation hook
- **ImageUploader.jsx**: Replaced hardcoded strings with translations
- **Modal.jsx**: Added translation support
- **Main entry file**: Import i18n configuration

### CSS Updates
- Added language switcher styling
- Improved responsive design for language buttons

### Bug Fixes
- Fixed pluralization in success messages
- Improved accessibility with proper ARIA labels for language switcher
- Fixed template name display in non-English languages

### Translation Coverage
- ✅ App titles and headers
- ✅ Upload section and buttons
- ✅ Processing mode selection
- ✅ Compression settings
- ✅ Output settings
- ✅ Resize and crop controls
- ✅ Template selection interface
- ✅ Image gallery
- ✅ Modal dialogs
- ✅ Success/error messages
- ✅ Loading states
- ✅ Footer information
- ✅ Template categories and names
- ✅ Pluralized messages

### Technical Improvements
- Centralized translation management
- Easy-to-extend translation system
- Component-level translation support
- Clean separation of UI and content

## [2.0.0] - 2025-12-15

### Major Changes
- **Complete CSS Rewrite**: Standardized styling system with CSS variables
- **No Gradients**: Removed all gradient backgrounds for cleaner, modern look
- **Responsive Design**: Improved mobile and tablet responsiveness
- **AI Integration**: Added TensorFlow.js for smarter image processing

### Features
- **Standardized Form Controls**: All inputs, selects, checkboxes use consistent styling
- **CSS Variables**: Centralized color system and spacing variables
- **Icon System**: Standardized icon sizing and spacing utilities
- **Accessibility**: Improved contrast ratios and focus states
- **Performance**: Optimized CSS file size and loading

### CSS Improvements
- Added comprehensive CSS variable system for colors, spacing, and typography
- Standardized button styling with multiple variants (primary, secondary, danger, outline)
- Fixed slider styling with better thumb design and hover effects
- Fixed crop mode button layout for mobile devices
- Added responsive grid system with utility classes
- Standardized alert/notification system with info, warning, success, and error variants

### Component Updates
- **ImageUploader**: Better drop zone styling and icon sizing
- **Modal**: Standardized modal styling with backdrop blur
- **App**: Updated to use new CSS classes throughout

### Bug Fixes
- Fixed icon sizing issues in text paragraphs
- Fixed crop mode buttons overflowing on smaller screens
- Fixed slider thumb styling and hover effects
- Fixed mobile layout issues with card headers and button groups
- Fixed template badge positioning

### Technical Improvements
- Added comprehensive JSDoc comments throughout codebase
- Consolidated and standardized CSS classes
- Removed duplicate styles and optimized CSS
- Added proper vendor prefixes for better browser compatibility

### Dependencies
- Updated TensorFlow.js integration for smarter AI cropping
- Enhanced SVG processing capabilities
- Improved WebP conversion quality

## [1.1.0] - 2025-12-01

### Added
- Initial release with basic image processing features
- Social media template system
- Batch processing capabilities
- ZIP export functionality

### Fixed
- Basic responsive design
- Image format detection
- File size optimization
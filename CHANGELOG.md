# Changelog

All notable changes to the Image LemGendizer project will be documented in this file.

## [2.0.0] - 2024-01-15

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

## [1.1.0] - 2023-12-01

### Added
- Initial release with basic image processing features
- Social media template system
- Batch processing capabilities
- ZIP export functionality

### Fixed
- Basic responsive design
- Image format detection
- File size optimization
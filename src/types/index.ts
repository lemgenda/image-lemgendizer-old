// Core Application Types

export type ProcessingMode = 'custom' | 'templates' | 'batch_rename';

// Image Processed State
export interface ImageFile {
    id: string;
    file: File;
    name: string;
    preview: string;
    originalWidth: number;
    originalHeight: number;
    size: number;
    type: string;
    url?: string;
    isTIFF?: boolean;
    isSVG?: boolean;
    format?: string;
    originalFormat?: string;
    processedWidth?: number;
    processedHeight?: number;
    processedSize?: number;
    upscaled?: boolean;
    aiCropped?: boolean;
    isLogo?: boolean;
    subjectProtected?: boolean;
    processed?: boolean;
    error?: string;
    isOriginal?: boolean;
    template?: any;
    method?: string;
}

// Processing Configuration
export interface OutputOptions {
    formats: string[];
    quality: number;
    targetSize?: number; // KB
    rename: boolean;
    newFileName: string;
}

export interface BatchRenameOptions {
    pattern: string; // e.g., "{name}-{counter}"
    find: string;
    replace: string;
    useRegex: boolean;
    casing: 'original' | 'uppercase' | 'lowercase' | 'camelCase' | 'kebabCase' | 'snakeCase';
    startSequence: number;
    stepSequence: number;
    zerosPadding: number;
    dateFormat: string;
}

export interface CropOptions {
    enabled: boolean;
    width: number;
    height: number;
    mode: string;
    position: string;
}

export interface ResizeOptions {
    enabled: boolean;
    dimension: string;
    // Legacy or alternative usage
    width?: number;
    height?: number;
    mode?: 'resize' | 'crop';
    cropPosition?: string;
}

export interface AIQualityOptions {
    deblur: boolean;
    dehazeIndoor: boolean;
    dehazeOutdoor: boolean;
    denoise: boolean;
    derain: boolean;
    lowLight: boolean;
    retouch: boolean;
    detailReconstruction: boolean;
    colorCorrection: boolean;
}

export interface CompressionOptions {
    quality: number;
    fileSize: string;
}

export interface ProcessingOptions {
    processingMode: ProcessingMode;
    output: OutputOptions;
    compression: CompressionOptions;
    resize: ResizeOptions;
    crop?: CropOptions;
    showResize: boolean;
    showCrop: boolean;
    resizeDimension: string;
    cropMode: string;
    cropWidth: string;
    cropHeight: string;
    cropPosition: string;
    showTemplates: boolean;
    selectedTemplates: string[]; // IDs of selected templates
    templateSelectedImage?: string | null;
    faviconMode?: 'basic' | 'complete';
    faviconSiteName?: string;
    faviconThemeColor?: string;
    faviconBackgroundColor?: string;
    smartCrop: boolean;
    batchRename?: BatchRenameOptions;
    aiQuality?: AIQualityOptions;
}

// Template System
export type CropPosition = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FocalPoint = { x: number; y: number };
export type ExportSettingsResult = { name: string; blob: Blob; format: string };
export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'ru' | 'ja' | 'ko' | 'zh';

export interface SmartCropConfig {
    useSmartCrop: boolean;
    strategy: string;
    preserveLogos: boolean;
    prioritySubject: string;
    minSubjectSize: number;
    maxPadding: number;
    tightCrop: boolean;
    quality: number;
    format: string;
}

export interface TemplateConfig {
    id: string;
    name: string;
    width: number | string;
    height: number | string;
    platform: string;
    category: string;
    icon?: string;
    templateName: string;
    cropMode: string;
    cropConfig: SmartCropConfig;
    aspectRatio?: number;
    description?: string;
    quality?: number;
    format?: string;
}

// Theme
export type Theme = 'light' | 'dark';

// Legacy / Test Compatibility Aliases
export type AppTemplate = TemplateConfig;
export type ExportSettings = any;
export type CropMode = string;

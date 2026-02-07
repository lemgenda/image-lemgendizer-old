/**
 * @file index.ts
 * @description Central TypeScript type and interface definitions for the application.
 */
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
    aiUpscaleScale?: number;
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

export interface CompressionOptions {
    quality: number;
    fileSize: string;
}

export interface FilterOptions {
    enabled: boolean;
    selectedFilter: string;
}

export interface ColorCorrectionOptions {
    enabled: boolean;
    brightness: number; // -100 to 100
    contrast: number; // -100 to 100
    saturation: number; // -100 to 100
    vibrance: number; // -100 to 100
    exposure: number; // -100 to 100
    hue: number; // 0 to 100
    sepia: number; // 0 to 100
    gamma: number; // 0 to 10 (displayed as 0.0 to 10.0)
    noise: number; // 0 to 100
    clip: number; // 0 to 100
    sharpen: number; // 0 to 100
    stackBlur: number; // 0 to 20
}

export interface WatermarkOptions {
    enabled: boolean;
    type: 'text' | 'image';
    text?: string;
    image?: string | null; // URL or Base64
    position: string;
    opacity: number; // 0.1 to 1.0 (internal), 10-100 (UI)
    size: 'small' | 'medium' | 'large' | 'extra-large';
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    repeat?: boolean;
}

export interface RestorationOptions {
    enabled: boolean;
    modelName: string; // e.g., 'mprnet-deraining-restoration-fp16', 'mirnet_v2-lowlight-restoration-fp16'
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
    filters?: FilterOptions;
    colorCorrection?: ColorCorrectionOptions;
    watermark?: WatermarkOptions;
    restoration?: RestorationOptions;
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

export interface ProcessingSummary {
    mode: string;
    imagesProcessed: number;
    operations: string[];
    aiUsed: boolean;
    upscalingUsed: boolean;
    totalFiles: number;
    success: boolean;
    errors: string[];
    templatesApplied: number;
    categoriesApplied: number;
    formatsExported: string[];
    screenshotCount?: number;
    watermarkApplied: boolean;
    upscaleScale?: number;
    upscaleModel?: string;
}

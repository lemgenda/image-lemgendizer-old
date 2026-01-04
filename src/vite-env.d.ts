/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_BROWSERLESS_API_TOKEN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

interface Navigator {
    gpu?: any;
}

declare module 'utif';

interface Window {
    UTIF: any;
    tf: any;
    cocoSsd: any;
}

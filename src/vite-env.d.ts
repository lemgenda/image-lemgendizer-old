/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BROWSERLESS_API_TOKEN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare module 'utif';

interface Window {
    UTIF: any;
    tf: any;
    cocoSsd: any;
}

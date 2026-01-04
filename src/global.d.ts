export {};

declare global {
  interface Window {
    UTIF: {
      decode: (buffer: ArrayBuffer) => any[];
      decodeImage: (buffer: ArrayBuffer, img: any, ifds?: any[]) => void;
      decodeImages: (buffer: ArrayBuffer, ifds: any[]) => void;
      toRGBA8: (img: any) => Uint8Array;
    };
  }
}

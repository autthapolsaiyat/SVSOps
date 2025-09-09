// FILE: src/types/ambient.d.ts
export {};

declare global {
  interface Window {
    svsProductPicker?: {
      open: (opts?: any) => Promise<any>;
    };
  }
}


export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
        showScanQrPopup?: (
          params: { text?: string },
          callback?: (text: string) => boolean | void
        ) => void;
        closeScanQrPopup?: () => void;
      };
    };
  }
}

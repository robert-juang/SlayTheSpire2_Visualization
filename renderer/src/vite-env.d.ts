/// <reference types="vite/client" />

import type { DesktopApi } from "../../main/preload";

declare global {
  interface Window {
    sts2Api: DesktopApi;
  }
}

export {};

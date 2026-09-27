import { writable } from 'svelte/store';
import type { Html5QrcodeScanner } from 'html5-qrcode';

export interface ScannerState {
  isScanning: boolean;
  useCameraMode: boolean;
  cameraError: string;
  cameraAvailable: boolean;
  showCameraSelector: boolean;
  barcodeInput: string;
  action: 'time_in' | 'time_out';
  purpose: string;
  scanning: boolean;
  scanError: string;
  scanMessage: string;
  showScanSuccess: boolean;
  selectedCameraId: string;
  availableCameras: Array<{ deviceId: string; label: string }>;
  lastScannedTime: number;
  scanResult: {
    memberName: string;
    memberType: string;
    department: string;
  };
  scanner: any | null;
}

export const initialState: ScannerState = {
  isScanning: false,
  useCameraMode: true,
  cameraError: '',
  cameraAvailable: false,
  showCameraSelector: false,
  barcodeInput: '',
  action: 'time_in' as const,
  purpose: '',
  scanning: false,
  scanError: '',
  scanMessage: '',
  showScanSuccess: false,
  selectedCameraId: '',
  availableCameras: [],
  lastScannedTime: 0,
  scanResult: {
    memberName: '',
    memberType: '',
    department: ''
  },
  scanner: null
};

/**
 * Create and export scanner state store
 */
export const scannerStore = writable<ScannerState>(initialState);

/**
 * Update specific state properties
 */
export function updateScannerState(updates: Partial<ScannerState>): void {
  scannerStore.update((state) => ({ ...state, ...updates }));
}

/**
 * Reset scanner to initial state
 */
export function resetScannerState(): void {
  scannerStore.set(initialState);
}

/**
 * Clear barcode input and success message
 */
export function clearScanInput(): void {
  scannerStore.update((state) => ({
    ...state,
    barcodeInput: '',
    scanError: '',
    showScanSuccess: false
  }));
}

/**
 * Set scan success and auto-hide after timeout
 */
export function setScanSuccess(
  memberName: string,
  memberType: string,
  department: string = '',
  timeoutMs: number = 5000
): void {
  updateScannerState({
    showScanSuccess: true,
    scanResult: { memberName, memberType, department },
    scanError: '',
    barcodeInput: ''
  });

  setTimeout(() => {
    scannerStore.update((state) => ({
      ...state,
      showScanSuccess: false
    }));
  }, timeoutMs);
}

/**
 * Set scan error
 */
export function setScanError(message: string): void {
  updateScannerState({
    scanError: message,
    showScanSuccess: false
  });
}

/**
 * Set camera error
 */
export function setCameraError(message: string): void {
  updateScannerState({
    cameraError: message,
    cameraAvailable: false
  });
}

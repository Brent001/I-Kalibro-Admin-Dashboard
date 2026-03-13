import { Html5QrcodeScanner } from 'html5-qrcode';

export interface CameraConfig {
  fps?: number;
  qrbox?: { width: number; height: number };
  disableFlip?: boolean;
  rememberLastUsedCamera?: boolean;
  experimentalFeatures?: any;
  formatsToSupport?: number[];
  aspectRatio?: number;
  videoConstraints?: any;
}

export interface Camera {
  deviceId: string;
  label: string;
}

/**
 * Get available cameras on the device
 */
export async function getAvailableCameras(): Promise<Camera[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'videoinput')
      .map((d) => ({ deviceId: d.deviceId, label: d.label || '' }));
  } catch (err) {
    console.error('Error enumerating cameras:', err);
    throw new Error('Unable to enumerate cameras. Please check permissions.');
  }
}

/**
 * Request camera permission from user
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop tracks immediately - we only wanted to prompt for permission
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch (err) {
    console.error('Camera permission denied:', err);
    return false;
  }
}

/**
 * Build camera configuration for html5-qrcode
 */
export function buildCameraConfig(selectedCameraId?: string): CameraConfig {
  const config: CameraConfig = {
    fps: 10,
    qrbox: { width: 300, height: 150 },
    disableFlip: false,
    rememberLastUsedCamera: true,
    experimentalFeatures: {
      useBarCodeDetectorIfSupported: true
    },
    formatsToSupport: [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
    ],
    aspectRatio: 1.777778
  };

  if (selectedCameraId) {
    config.videoConstraints = {
      deviceId: { exact: selectedCameraId }
    };
  } else {
    config.videoConstraints = {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };
  }

  return config;
}

/**
 * Initialize and render html5-qrcode scanner
 */
export async function initializeScanner(
  containerId: string,
  config: Partial<CameraConfig>,
  onSuccess: (text: string) => void,
  onError?: (error: string) => void,
  maxRetries: number = 3
): Promise<Html5QrcodeScanner | null> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Scanner container element (${containerId}) not found in DOM`);
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const scanner = new Html5QrcodeScanner(containerId, config as any, false);

    try {
      await scanner.render(
        (decodedText: string) => {
          console.log('Barcode detected:', decodedText);
          onSuccess(decodedText);
        },
        (errorMessage: string) => {
          // Ignore per-frame detection errors
        }
      );

      console.log('Scanner rendered successfully');
      return scanner;
    } catch (err) {
      lastError = err;
      console.error(`Render attempt ${attempt + 1} failed:`, err);

      try {
        await scanner.clear();
      } catch (e) {
        // ignore
      }

      // Retry with relaxed constraints
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 300));
        // Remove device ID constraint for next attempt
        if ((config as any).videoConstraints?.deviceId) {
          config.videoConstraints = {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };
        }
      }
    }
  }

  const errorMsg = `Camera access failed: ${
    lastError instanceof Error ? lastError.message : 'Unable to access camera'
  }`;
  console.error(errorMsg);
  if (onError) onError(errorMsg);

  return null;
}

/**
 * Stop and clear scanner
 */
export async function stopScanner(scanner: Html5QrcodeScanner | null): Promise<void> {
  if (!scanner) return;
  try {
    console.log('Clearing scanner...');
    await scanner.clear();
    console.log('Scanner cleared');
  } catch (err) {
    console.warn('Error clearing scanner:', err);
  }
}

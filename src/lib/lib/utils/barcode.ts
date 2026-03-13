export interface ScanResult {
  success: boolean;
  message: string;
  memberName?: string;
  memberType?: string;
  department?: string;
  timestamp?: string;
}

export interface ScanRequest {
  barcode: string;
  action: 'time_in' | 'time_out';
  purpose: string;
}

/**
 * Play a success tone using Web Audio API
 */
export function playSuccessSound(): void {
  try {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.1;

    oscillator.start();
    setTimeout(() => oscillator.stop(), 100);
  } catch (err) {
    console.warn('Audio not supported:', err);
  }
}

/**
 * Validate barcode input
 */
export function validateBarcode(barcode: string): boolean {
  return barcode.trim().length > 0;
}

/**
 * Process barcode scan through API
 */
export async function processBarcodeScan(
  scanRequest: ScanRequest
): Promise<ScanResult> {
  if (!validateBarcode(scanRequest.barcode)) {
    return {
      success: false,
      message: 'Please enter a valid barcode'
    };
  }

  try {
    const response = await fetch('/api/barcode/scan-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(scanRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Error processing barcode:', err);
    return {
      success: false,
      message: 'Error processing barcode. Please try again.'
    };
  }
}

/**
 * Format date for display
 */
export function formatScanDate(dateString: string): string {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Get color styling for member type
 */
export function getMemberTypeColor(type: string): string {
  return type === 'student'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-purple-50 text-purple-700 border-purple-200';
}

/**
 * Debounce function for rapid scans
 */
export function createScanDebounce(delayMs: number = 2500): (fn: () => void) => boolean {
  let lastTime = 0;

  return (fn: () => void): boolean => {
    const now = Date.now();
    if (now - lastTime > delayMs) {
      lastTime = now;
      fn();
      return true;
    }
    return false;
  };
}

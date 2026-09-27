/// <reference types="html5-qrcode" />
/**
 * Debug utility for barcode scanner functionality
 */

export function checkScannerEnvironment() {
  const checks = {
    browser: typeof window !== 'undefined',
    hasNavigator: typeof navigator !== 'undefined',
    hasMediaDevices: typeof navigator !== 'undefined' && !!(navigator.mediaDevices),
    hasGetUserMedia: typeof navigator !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia),
    hasHtml5Qrcode: typeof window !== 'undefined' && typeof (window as any).Html5Qrcode !== 'undefined',
    isHttps: typeof window !== 'undefined' && window.location.protocol === 'https:',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
  };

  console.log('Scanner Environment Check:', checks);
  
  const issues = [];
  
  if (!checks.browser) {
    issues.push('Not running in browser environment');
  }
  
  if (!checks.hasNavigator) {
    issues.push('Navigator not available');
  }
  
  if (!checks.hasMediaDevices) {
    issues.push('MediaDevices API not available');
  }
  
  if (!checks.hasGetUserMedia) {
    issues.push('getUserMedia API not available');
  }
  
  if (!checks.isHttps && checks.browser) {
    issues.push('Not using HTTPS - camera access may be restricted');
  }
  
  console.log('Issues found:', issues);
  
  return {
    checks,
    issues,
    ready: issues.length === 0
  };
}

export function testCameraAccess() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return Promise.resolve({ success: false, error: 'MediaDevices not available' });
  }
  
  return navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      // Stop the stream immediately
      stream.getTracks().forEach(track => track.stop());
      return { success: true, error: null };
    })
    .catch((error) => {
      console.error('Camera access error:', error);
      return { success: false, error: error.message };
    });
}

export function listCameras() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return Promise.resolve([]);
  }
  
  return navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      return devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`,
          kind: device.kind
        }));
    })
    .catch((error) => {
      console.error('Error enumerating cameras:', error);
      return [];
    });
}
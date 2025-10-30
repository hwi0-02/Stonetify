import { Platform, ToastAndroid, Alert } from 'react-native';

let webToastElement = null;
let webToastHideTimer = null;

const ensureWebToastElement = () => {
  if (webToastElement || typeof document === 'undefined') {
    return webToastElement;
  }

  const container = document.createElement('div');
  container.setAttribute('data-testid', 'stonetify-toast');
  container.style.position = 'fixed';
  container.style.bottom = '40px';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  container.style.color = '#ffffff';
  container.style.padding = '12px 20px';
  container.style.borderRadius = '999px';
  container.style.fontSize = '14px';
  container.style.fontWeight = '600';
  container.style.letterSpacing = '0.3px';
  container.style.boxShadow = '0 4px 18px rgba(0,0,0,0.35)';
  container.style.opacity = '0';
  container.style.transition = 'opacity 150ms ease-in-out';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';

  document.body.appendChild(container);
  webToastElement = container;
  return container;
};

export function showToast(message, duration = 2000) {
  const resolvedDuration = Number.isFinite(duration) ? Math.max(500, duration) : 2000;

  if (Platform.OS === 'android') {
    return new Promise((resolve) => {
      const toastDuration = resolvedDuration > 2500 ? ToastAndroid.LONG : ToastAndroid.SHORT;
      ToastAndroid.show(message, toastDuration);
      setTimeout(resolve, resolvedDuration);
    });
  }

  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const element = ensureWebToastElement();
      if (!element) {
        resolve();
        return;
      }

      if (webToastHideTimer) {
        clearTimeout(webToastHideTimer);
        webToastHideTimer = null;
      }

      element.textContent = message;

      // Force reflow so opacity transition always triggers
      void element.offsetWidth; // eslint-disable-line no-unused-expressions

      element.style.opacity = '1';

      webToastHideTimer = setTimeout(() => {
        element.style.opacity = '0';
        webToastHideTimer = setTimeout(() => {
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            webToastElement = null;
          }
          resolve();
        }, 200);
      }, resolvedDuration);
    });
  }

  // Fallback (iOS / others)
  return new Promise((resolve) => {
    Alert.alert('', message);
    setTimeout(resolve, resolvedDuration);
  });
}

const listeners = [];

export function track(event, props = {}) {
  const payload = { event, ts: Date.now(), ...props };
  if (__DEV__) {
    console.log('[analytics]', payload);
  }
  listeners.forEach(l => {
    try { l(payload); } catch (e) { /* swallow */ }
  });
}

export function addAnalyticsListener(fn) { listeners.push(fn); return () => removeAnalyticsListener(fn); }
export function removeAnalyticsListener(fn) {
  const i = listeners.indexOf(fn);
  if (i >= 0) listeners.splice(i, 1);
}

export function instrumentAdapterSwitch(type) {
  track('adapter_switch', { type });
}

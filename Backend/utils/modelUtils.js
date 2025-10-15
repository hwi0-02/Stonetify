const buildUpdatePayload = (current, updates) => {
  const payload = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (current[key] !== value) {
      payload[key] = value;
    }
  });
  if (Object.keys(payload).length) {
    payload.updated_at = Date.now();
  }
  return payload;
};

const buildCreatePayload = (data, defaults = {}) => ({
  ...defaults,
  ...data,
  created_at: defaults.created_at || Date.now(),
  updated_at: defaults.updated_at || Date.now(),
});

module.exports = {
  buildUpdatePayload,
  buildCreatePayload,
};

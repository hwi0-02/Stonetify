export const createStatusHandlers = ({ statusKey = 'status', errorKey = 'error' } = {}) => {
  const setValue = (state, key, value) => {
    if (typeof key !== 'string' || !key.length) return;
    state[key] = value;
  };

  const getErrorValue = (action, fallback = null) => {
    if (!action) return fallback;
    if (action.payload !== undefined) return action.payload;
    if (action.error?.message) return action.error.message;
    return fallback;
  };

  return {
    setPending(state) {
      setValue(state, statusKey, 'loading');
      setValue(state, errorKey, null);
    },
    setFulfilled(state) {
      setValue(state, statusKey, 'succeeded');
      setValue(state, errorKey, null);
    },
    setRejected(state, action) {
      setValue(state, statusKey, 'failed');
      setValue(state, errorKey, getErrorValue(action));
    },
  };
};

export default {
  createStatusHandlers,
};

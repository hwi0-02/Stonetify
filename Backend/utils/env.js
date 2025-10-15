const { REQUIRED_ENV } = require('./constants');
const { logger } = require('./logger');

const checkEnvVars = (requiredVars, { scope }) => {
  const missing = requiredVars.filter((key) => !process.env[key]);
  if (missing.length) {
    logger.warn(`Missing environment variables for ${scope}`, { missing });
  }
  return missing;
};

const validateEnvironment = () => {
  const missingGeneral = checkEnvVars(REQUIRED_ENV.GENERAL, { scope: 'general' });
  const missingFirebase = checkEnvVars(REQUIRED_ENV.FIREBASE, { scope: 'firebase' });

  return {
    general: missingGeneral,
    firebase: missingFirebase,
  };
};

module.exports = {
  validateEnvironment,
};

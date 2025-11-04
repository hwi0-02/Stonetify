const parseList = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildAllowedList = (defaultUri, additionalEnvValue, extraAllowed = []) => {
  const allowed = new Set();
  if (defaultUri) {
    allowed.add(defaultUri.trim());
  }
  for (const uri of parseList(additionalEnvValue)) {
    allowed.add(uri);
  }
  for (const uri of extraAllowed) {
    if (uri) {
      allowed.add(uri.trim());
    }
  }
  return Array.from(allowed);
};

const PROVIDER_CALLBACK_PATH = {
  kakao: 'kakao-callback',
  naver: 'naver-callback',
};

function getRedirectConfig(provider) {
  switch (provider) {
    case 'kakao':
      return {
        defaultUri: process.env.KAKAO_REDIRECT_URI,
        allowedEnv: process.env.KAKAO_ALLOWED_REDIRECT_URIS,
      };
    case 'naver':
      return {
        defaultUri: process.env.NAVER_REDIRECT_URI,
        allowedEnv: process.env.NAVER_ALLOWED_REDIRECT_URIS,
      };
    default:
      return { defaultUri: null, allowedEnv: null };
  }
}

function getExtraAllowedUris(provider) {
  const extras = [];
  const path = PROVIDER_CALLBACK_PATH[provider];
  if (path) {
    extras.push(`stonetify://${path}`);
  }

  const owner = process.env.EXPO_OWNER;
  const slug = process.env.EXPO_SLUG;
  if (owner && slug) {
    extras.push(`https://auth.expo.io/@${owner}/${slug}`);
  }

  return extras.filter(Boolean);
}

const resolveRedirectUri = ({
  provider,
  requestedUri,
  defaultUri,
  additionalEnvValue,
  extraAllowed = [],
}) => {
  const allowedList = buildAllowedList(defaultUri, additionalEnvValue, extraAllowed);

  if (requestedUri) {
    const trimmed = requestedUri.trim();
    const isAllowed = allowedList.some((allowed) => {
      if (trimmed === allowed) {
        return true;
      }
      if (allowed && trimmed.startsWith(`${allowed}?`)) {
        return true;
      }
      if (allowed && trimmed.startsWith(`${allowed}#`)) {
        return true;
      }
      return false;
    });

    if (isAllowed) {
      return { redirectUri: trimmed, allowedList };
    }

    const error = new Error(`Invalid redirect_uri for ${provider}`);
    error.code = 'INVALID_REDIRECT_URI';
    error.allowedList = allowedList;
    error.requestedUri = trimmed;
    throw error;
  }

  if (!allowedList.length) {
    const error = new Error(`Missing redirect_uri configuration for ${provider}`);
    error.code = 'MISSING_REDIRECT_URI';
    throw error;
  }

  return { redirectUri: allowedList[0], allowedList };
};

module.exports = {
  resolveRedirectUri,
  resolveSocialRedirectUri: ({ provider, requestedUri }) => {
    const { defaultUri, allowedEnv } = getRedirectConfig(provider);
    return resolveRedirectUri({
      provider,
      requestedUri: requestedUri || undefined,
      defaultUri,
      additionalEnvValue: allowedEnv,
      extraAllowed: getExtraAllowedUris(provider),
    });
  },
  getRedirectConfig,
  getExtraAllowedUris,
};

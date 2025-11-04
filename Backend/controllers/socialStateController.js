const socialStateStore = require('../utils/socialStateStore');
const getRequestFingerprint = require('../utils/requestFingerprint');
const { resolveSocialRedirectUri } = require('../utils/oauthRedirect');

const SUPPORTED_PROVIDERS = new Set(['kakao', 'naver']);

function validateProvider(provider) {
  if (!provider || !SUPPORTED_PROVIDERS.has(provider)) {
    return false;
  }
  return true;
}

exports.createState = (req, res) => {
  try {
    const userId = req.user?.id;
    const { provider, redirectUri: requestedRedirectUri } = req.body || {};

    if (!userId) {
      return res.status(401).json({ message: '인증 정보가 없습니다.' });
    }

    if (!validateProvider(provider)) {
      return res.status(400).json({ message: '지원하지 않는 provider 입니다.' });
    }

    let resolvedRedirectUri = null;
    try {
      ({ redirectUri: resolvedRedirectUri } = resolveSocialRedirectUri({
        provider,
        requestedUri: requestedRedirectUri,
      }));
    } catch (err) {
      if (err.code === 'INVALID_REDIRECT_URI') {
        return res.status(400).json({
          message: '허용되지 않은 redirect_uri 입니다.',
          allowedRedirectUris: err.allowedList,
        });
      }
      console.error('Failed to resolve social redirect URI (protected):', err.message);
      return res.status(500).json({ message: 'OAuth redirect 설정을 확인해주세요.' });
    }

    const fingerprint = getRequestFingerprint(req);
    const state = socialStateStore.issueState({
      provider,
      userId,
      fingerprint: fingerprint || null,
      redirectUri: resolvedRedirectUri,
    });

    return res.json({
      state,
      expiresInMs: socialStateStore.STATE_TTL_MS,
    });
  } catch (err) {
    console.error('Failed to create protected social OAuth state:', err);
    return res.status(500).json({ message: 'OAuth 상태값을 생성할 수 없습니다.' });
  }
};

exports.createPublicState = (req, res) => {
  try {
    const { provider, redirectUri: requestedRedirectUri } = req.body || {};

    if (!validateProvider(provider)) {
      return res.status(400).json({ message: '지원하지 않는 provider 입니다.' });
    }

    const fingerprint = getRequestFingerprint(req);

    if (!fingerprint) {
      return res.status(400).json({ message: '요청을 식별할 수 없습니다.' });
    }

    let resolvedRedirectUri = null;
    try {
      ({ redirectUri: resolvedRedirectUri } = resolveSocialRedirectUri({
        provider,
        requestedUri: requestedRedirectUri,
      }));
    } catch (err) {
      if (err.code === 'INVALID_REDIRECT_URI') {
        return res.status(400).json({
          message: '허용되지 않은 redirect_uri 입니다.',
          allowedRedirectUris: err.allowedList,
        });
      }
      console.error('Failed to resolve social redirect URI (public):', err.message);
      return res.status(500).json({ message: 'OAuth redirect 설정을 확인해주세요.' });
    }

    const state = socialStateStore.issueState({
      provider,
      fingerprint,
      redirectUri: resolvedRedirectUri,
    });

    return res.json({
      state,
      expiresInMs: socialStateStore.STATE_TTL_MS,
    });
  } catch (err) {
    console.error('Failed to create public social OAuth state:', err);
    return res.status(500).json({ message: 'OAuth 상태값을 생성할 수 없습니다.' });
  }
};

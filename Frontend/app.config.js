const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const HTTP_SCHEME_REGEX = /^https?:\/\//i;
const SOCIAL_CALLBACK_PATH = {
  kakao: 'kakao-callback',
  naver: 'naver-callback',
};

const buildRedirectFromApi = (apiUrl, callbackPath) => {
  if (!apiUrl || typeof apiUrl !== 'string') return null;
  try {
    const normalizedApi = apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`;
    const baseUrl = normalizedApi.replace(/\/api\/?$/i, '/');
    const built = new URL(callbackPath, baseUrl).toString();
    if (!HTTP_SCHEME_REGEX.test(built)) {
      return null;
    }
    return built.endsWith('/') && !callbackPath.endsWith('/') ? built.slice(0, -1) : built;
  } catch (error) {
    return null;
  }
};

const deriveSocialRedirectUri = (explicitValue, fallbackPath) => {
  if (explicitValue && explicitValue.trim()) {
    return explicitValue.trim();
  }

  const apiCandidates = [
    process.env.EXPO_PUBLIC_API_URL,
    process.env.EXPO_PUBLIC_TUNNEL_API_URL,
    process.env.TUNNEL_API_URL,
    process.env.DEV_API_URL,
    process.env.EXPO_PUBLIC_LOCAL_API_URL,
  ];

  for (const apiUrl of apiCandidates) {
    const derived = buildRedirectFromApi(apiUrl, fallbackPath);
    if (derived) {
      return derived;
    }
  }

  return `stonetify://${fallbackPath}`;
};

module.exports = ({ config }) => {
  const spotifyClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '84d1bbffeb7e419088d64740c137100e';
  const spotifyRedirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || process.env.SPOTIFY_APP_REDIRECT || 'stonetify://redirect';
  const backendRedirectUri = process.env.EXPO_PUBLIC_BACKEND_REDIRECT_URI || process.env.BACKEND_REDIRECT_URI || spotifyRedirectUri;
  
  const kakaoRestApiKey = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY || '';
  const kakaoRedirectUri = deriveSocialRedirectUri(process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI, SOCIAL_CALLBACK_PATH.kakao);
  
  const naverClientId = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '';
  const naverRedirectUri = deriveSocialRedirectUri(process.env.EXPO_PUBLIC_NAVER_REDIRECT_URI, SOCIAL_CALLBACK_PATH.naver);

  return {
    expo: {
      name: 'Stonetify',
      slug: 'Stonetify',
      version: '1.0.0',
      scheme: 'stonetify',
      owner: 'hwi0',
      orientation: 'portrait',
      icon: './assets/images/icon.png',
      userInterfaceStyle: 'dark',
      jsEngine: 'hermes',
      splash: {
        image: './assets/images/icon.png',
        resizeMode: 'contain',
        backgroundColor: '#121212'
      },
      assetBundlePatterns: [
        '**/*'
      ],
      ios: {
        supportsTablet: true,
        bundleIdentifier: 'com.yourcompany.stonetify'
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#121212'
        },
        package: 'com.yourcompany.stonetify'
      },
      web: {
        favicon: './assets/images/favicon.png'
      },
      plugins: [
        'expo-audio',
        [
          'sentry-expo',
          {
            organization: '__CHANGE_ME_OPTIONAL__',
            project: 'stonetify'
          }
        ],
        'expo-web-browser'
      ],
      extra: {
        spotifyClientId,
        EXPO_PUBLIC_SPOTIFY_REDIRECT_URI: spotifyRedirectUri,
        spotifyRedirectUri,
        backendRedirectUri,
        kakaoRestApiKey,
        kakaoRedirectUri,
        naverClientId,
        naverRedirectUri,
        eas: {
          projectId: 'Stonetify'
        }
      }
    }
  };
};

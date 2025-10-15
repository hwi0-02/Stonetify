const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = ({ config }) => {
  const spotifyClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '84d1bbffeb7e419088d64740c137100e';
  const spotifyRedirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI || process.env.SPOTIFY_APP_REDIRECT || 'stonetify://redirect';
  const backendRedirectUri = process.env.EXPO_PUBLIC_BACKEND_REDIRECT_URI || process.env.BACKEND_REDIRECT_URI || spotifyRedirectUri;

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
        eas: {
          projectId: 'Stonetify'
        }
      }
    }
  };
};

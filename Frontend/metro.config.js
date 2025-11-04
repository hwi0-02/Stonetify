// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// 성능 최적화 설정
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      // inline requires 활성화: 초기 번들 사이즈 감소 + 지연 로딩
      inlineRequires: true,
    },
  }),
};

// 캐싱 최적화
config.resetCache = false;

// 번들 크기 최적화
config.serializer = {
  ...config.serializer,
  // 최소화 설정
  customSerializer: config.serializer?.customSerializer,
};

module.exports = config;
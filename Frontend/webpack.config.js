// [Frontend/webpack.config.js]

const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // react-native-gesture-handler가 웹에서 올바르게 작동하도록
  // Babel 로더 설정을 추가합니다.
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    include: (filepath) => /node_modules\/react-native-gesture-handler/.test(filepath),
    use: 'babel-loader',
  });

  return config;
};
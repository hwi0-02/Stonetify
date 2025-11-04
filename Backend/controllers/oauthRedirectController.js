const axios = require('axios');
const { resolveRedirectUri } = require('../utils/oauthRedirect');

const KAKAO_AUTH_URL = 'https://kauth.kakao.com';

exports.exchangeKakaoToken = async (req, res) => {
  try {
    const { code, state, redirectUri: requestedRedirectUri } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, message: 'code is required' });
    }

    let redirectUri;
    try {
      ({ redirectUri } = resolveRedirectUri({
        provider: 'kakao',
        requestedUri: requestedRedirectUri,
        defaultUri: process.env.KAKAO_REDIRECT_URI,
        additionalEnvValue: process.env.KAKAO_ALLOWED_REDIRECT_URIS,
      }));
    } catch (err) {
      if (err.code === 'INVALID_REDIRECT_URI') {
        return res.status(400).json({
          success: false,
          message: '허용되지 않은 redirect_uri 입니다.',
          allowedRedirectUris: err.allowedList,
        });
      }
      console.error('[Kakao Redirect] redirect URI resolve failed:', err.message);
      return res.status(500).json({ success: false, message: '카카오 Redirect URI 설정을 확인해주세요.' });
    }

    console.log('[Kakao Redirect] requesting token via REST API', { redirectUri, state: state || null });

    const tokenResponse = await axios.post(
      `${KAKAO_AUTH_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY,
        client_secret: process.env.KAKAO_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        code,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    return res.json({ success: true, data: tokenResponse.data });
  } catch (err) {
    const status = err.response?.status || 500;
    const errorData = err.response?.data;
    console.error('[Kakao Redirect] token request failed:', errorData || err.message);
    return res.status(status).json({
      success: false,
      message: '카카오 토큰 요청에 실패했습니다.',
      error: errorData || err.message,
    });
  }
};

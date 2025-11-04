// Backend/utils/returnUrlValidator.js
// returnUrl 화이트리스트 검증 (오픈 리다이렉트 방지)

/**
 * returnUrl이 허용된 origin/scheme에 속하는지 검증
 * @param {string} returnUrl - 검증할 returnUrl
 * @returns {boolean} - 허용 여부
 */
function validateReturnUrl(returnUrl) {
  if (!returnUrl || typeof returnUrl !== 'string') {
    return false;
  }

  // 환경 변수에서 허용된 origin 목록 가져오기
  const allowedOriginsEnv = process.env.ALLOWED_RETURN_ORIGINS || '';
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    console.warn('⚠️ [returnUrlValidator] ALLOWED_RETURN_ORIGINS not configured');
    return false;
  }

  try {
    // HTTP/HTTPS URL 검증
    if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
      const urlObj = new URL(returnUrl);
      const origin = urlObj.origin; // https://example.com

      // origin이 허용 목록에 있는지 확인
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.startsWith('http://') || allowed.startsWith('https://')) {
          return origin === allowed;
        }
        return false;
      });

      if (!isAllowed) {
        console.warn('❌ [returnUrlValidator] Disallowed origin:', origin);
        return false;
      }

      return true;
    }

    // Deep link (stonetify://) 검증
    if (returnUrl.startsWith('stonetify://')) {
      // 허용 목록에 stonetify:// scheme이 있는지 확인
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.startsWith('stonetify://')) {
          // 정확히 일치하거나 prefix로 시작하는지 확인
          return returnUrl === allowed || returnUrl.startsWith(allowed);
        }
        return false;
      });

      if (!isAllowed) {
        console.warn('❌ [returnUrlValidator] Disallowed deep link:', returnUrl);
        return false;
      }

      return true;
    }

    // 지원하지 않는 스킴
    console.warn('❌ [returnUrlValidator] Unsupported scheme:', returnUrl);
    return false;

  } catch (err) {
    console.error('❌ [returnUrlValidator] Validation error:', err.message);
    return false;
  }
}

/**
 * returnUrl 검증 미들웨어
 */
function validateReturnUrlMiddleware(req, res, next) {
  const { returnUrl } = req.query;

  if (!returnUrl) {
    return res.status(400).json({ 
      message: 'returnUrl is required' 
    });
  }

  if (!validateReturnUrl(returnUrl)) {
    const allowedOriginsEnv = process.env.ALLOWED_RETURN_ORIGINS || '';
    const allowedOrigins = allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean);
    
    return res.status(400).json({ 
      message: 'Invalid returnUrl. Only whitelisted origins are allowed.',
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ['Not configured']
    });
  }

  next();
}

module.exports = {
  validateReturnUrl,
  validateReturnUrlMiddleware,
};

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[0];
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    ''
  );
}

function getRequestFingerprint(req) {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  return `${ip}|${ua}|${acceptLang}`.trim();
}

module.exports = getRequestFingerprint;

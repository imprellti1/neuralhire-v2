export function corsMiddleware(options = {}) {
  const allowedOrigins = String(options.origin || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const methods = options.methods || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  const headers = options.headers || 'Content-Type,Authorization,X-Request-Id,X-Test-Role,X-Test-Account-Id';

  return async (req, res) => {
    const requestOrigin = req.headers?.origin || req.headers?.Origin || '';
    const allowAny = allowedOrigins.includes('*');
    const matchedOrigin = allowAny ? '*' : allowedOrigins.find((origin) => origin === requestOrigin) || allowedOrigins[0] || '';
    if (matchedOrigin) res.setHeader('Access-Control-Allow-Origin', matchedOrigin);
    if (!allowAny) res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id');

    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
      res.setHeader('Content-Length', '0');
      res.statusCode = 204;
      res.end();
      return false;
    }

    return true;
  };
}

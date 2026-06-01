export function corsMiddleware(options = {}) {
  const origin = options.origin || '*';
  const methods = options.methods || 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
  const headers = options.headers || 'Content-Type,Authorization,X-Request-Id,X-Test-Role,X-Test-Account-Id';

  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', origin);
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

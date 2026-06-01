export function securityHeadersMiddleware() {
  return async (req, res, context) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Request-Id', context.requestId);
    return true;
  };
}

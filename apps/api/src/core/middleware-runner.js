export async function runMiddlewares(middlewares, req, res, context) {
  for (const middleware of middlewares || []) {
    const result = await middleware(req, res, context);
    if (result === false) return false;
  }
  return true;
}

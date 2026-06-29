import { sendJson } from '../core/response.js';

const HEADER_NAME = 'x-neuralhire-webhook-token';

function getWebhookTokenHeader(headers = {}) {
  return headers[HEADER_NAME] || headers['X-NeuralHire-Webhook-Token'] || headers['x-neuralhire-webhook-token'];
}

export function webhookAuthMiddleware() {
  return async (req, res) => {
    const configuredToken = process.env.NEURALHIRE_WEBHOOK_TOKEN;

    if (!configuredToken) {
      sendJson(res, 500, {
        ok: false,
        error: {
          code: 'WEBHOOK_TOKEN_NOT_CONFIGURED',
          message: 'Webhook token não configurado.'
        }
      });
      return false;
    }

    const incomingToken = getWebhookTokenHeader(req.headers);
    if (incomingToken !== configuredToken) {
      sendJson(res, 401, {
        ok: false,
        error: {
          code: 'INVALID_WEBHOOK_TOKEN',
          message: 'Token inválido.'
        }
      });
      return false;
    }

    return true;
  };
}

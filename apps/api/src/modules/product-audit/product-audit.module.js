import { defineModule } from '../../core/module-contract.js';

export const productAuditModule = defineModule({
  name: 'product-audit',
  domain: 'product-audit',
  routes: [
    'GET /product-audit/summary',
    'GET /product-audit/products',
    'GET /product-audit/products/:productId',
    'PATCH /product-audit/products/:productId/fabricante',
    'PATCH /product-audit/products/:productId/fix'
  ]
});

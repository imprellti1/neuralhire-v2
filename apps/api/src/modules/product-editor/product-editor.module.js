import { defineModule } from '../../core/module-contract.js';

export const productEditorModule = defineModule({
  name: 'product-editor',
  domain: 'produtos-catalogo',
  dependencies: ['produtos', 'fabricantes'],
  routes: [
    'GET /product-editor/products',
    'GET /product-editor/products/:productId',
    'PATCH /product-editor/products/:productId',
    'PATCH /product-editor/products/:productId/images',
    'GET /product-editor/products/:productId/variations',
    'POST /product-editor/products/:productId/variations',
    'PATCH /product-editor/products/:productId/variations/:variationId',
    'PATCH /product-editor/products/:productId/variations/:variationId/image'
  ]
});

import { bootstrapWebApp } from '../../app.js'; import { assert } from '../../testing/frontend-test-helpers.js';
export async function run(){ const h=window.location.hash; document.body.innerHTML=''; window.location.hash='#/executive-dashboard'; bootstrapWebApp(); assert(document.body.textContent.includes('Executive Dashboard')); window.location.hash=h; }

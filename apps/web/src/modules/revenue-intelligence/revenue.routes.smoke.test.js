import { bootstrapWebApp } from '../../app.js'; import { assert } from '../../testing/frontend-test-helpers.js';
export async function run(){ const h=window.location.hash; document.body.innerHTML=''; window.location.hash='#/revenue-intelligence'; bootstrapWebApp(); assert(document.body.textContent.includes('Revenue Intelligence')); window.location.hash=h; }

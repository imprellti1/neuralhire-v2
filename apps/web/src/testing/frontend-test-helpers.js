import { JSDOM } from 'jsdom';

export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function setupFrontendDom(hash = '#/') {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: `http://localhost/${hash}` });
  global.window = dom.window;
  global.document = dom.window.document;
  global.Blob = dom.window.Blob;
  global.URL = dom.window.URL;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  return dom;
}

export function teardownFrontendDom(dom) {
  dom.window.close();
  delete global.window;
  delete global.document;
  delete global.Blob;
  delete global.URL;
  delete global.Event;
  delete global.KeyboardEvent;
  delete global.fetch;
}

export function setHash(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
}

export function mockObjectUrl() {
  let count = 0;
  URL.createObjectURL = () => `blob:mock-${++count}`;
  URL.revokeObjectURL = () => {};
}

export function mockAnchorClicks(dom) {
  const clicks = [];
  const original = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function click() {
    clicks.push(this.download || this.href || '');
  };
  return {
    clicks,
    restore() {
      dom.window.HTMLAnchorElement.prototype.click = original;
    }
  };
}

export function findButtonByText(text) {
  return Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent?.trim() === text) || null;
}

export function dispatchInput(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function dispatchChange(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function dispatchKeydown(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

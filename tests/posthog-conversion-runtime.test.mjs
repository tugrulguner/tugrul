import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const tracked = [...html.matchAll(/<a\b([^>]*\bdata-posthog-event="[^"]+"[^>]*)>/g)].map(([, source]) => {
  const attr = (name) => source.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const dataset = {};
  for (const [, key, value] of source.matchAll(/\bdata-posthog-([\w-]+)="([^"]*)"/g)) {
    const prop = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    dataset[`posthog${prop[0].toUpperCase()}${prop.slice(1)}`] = value;
  }
  return { source, dataset, href: attr('href') };
});
assert.ok(tracked.length > 0, 'marked conversion links should exist');
for (const { source } of tracked) {
  assert.match(source, /\bclass="[^"]*\bph-no-autocapture\b/, 'all tracked links exclude autocapture');
}

const listeners = {};
const captures = [];
class Element {
  constructor(link) { this.link = link; }
  closest(selector) { assert.equal(selector, '[data-posthog-event]'); return this.link; }
}
const context = {
  Element,
  document: {
    getElementById: () => ({ textContent: '' }),
    addEventListener: (type, listener) => { listeners[type] = listener; },
  },
  window: { posthog: { capture: (...args) => captures.push(args) } },
  Date,
};
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1], context);
assert.equal(typeof listeners.click, 'function');
assert.equal(typeof listeners.auxclick, 'function');

for (const link of tracked) {
  const target = new Element({ ...link, dataset: link.dataset });
  const expectedProperties = { surface: link.dataset.posthogSurface, destination: link.href };
  for (const property of ['project', 'network', 'content']) {
    const value = link.dataset[`posthog${property[0].toUpperCase()}${property.slice(1)}`];
    if (value) expectedProperties[property] = value;
  }
  const expectedCapture = [link.dataset.posthogEvent, expectedProperties, { transport: 'sendBeacon', send_instantly: true }];
  listeners.click({ target });
  assert.deepEqual(JSON.parse(JSON.stringify(captures.pop())), expectedCapture);
  listeners.auxclick({ target, button: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(captures.pop())), expectedCapture);
}
assert.equal(captures.length, 0);
const sample = new Element({ dataset: { posthogEvent: 'test' }, href: 'https://example.com' });
listeners.auxclick({ target: sample, button: 2 });
listeners.auxclick({ target: sample, button: 0 });
assert.equal(captures.length, 0, 'right and non-middle auxclicks are ignored');
listeners.click({ target: {} });
assert.equal(captures.length, 0, 'non-Element click targets are ignored');
const missingSdkListeners = {};
const withoutPosthog = {
  ...context,
  window: {},
  document: { getElementById: () => ({ textContent: '' }), addEventListener: (type, listener) => { missingSdkListeners[type] = listener; } },
};
vm.runInNewContext(scripts.at(-1)[1], withoutPosthog);
missingSdkListeners.click({ target: sample });
missingSdkListeners.auxclick({ target: sample, button: 1 });
assert.equal(captures.length, 0, 'missing SDK does not throw or capture');
console.log(`Runtime conversion checks passed (${tracked.length} marked links; click and middle-click each; right-click and invalid targets ignored).`);

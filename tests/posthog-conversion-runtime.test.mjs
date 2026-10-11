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
const expectedEvents = [
  'email_clicked', 'github_profile_clicked', 'medium_article_clicked', 'medium_clicked',
  'modepot_clicked', 'modepot_project_clicked', 'newsletter_article_clicked',
  'newsletter_clicked', 'newsletter_subscribe_clicked', 'resume_downloaded',
  'scholar_clicked', 'social_profile_clicked',
];
const eventsByName = new Map();
for (const { source, dataset, href } of tracked) {
  assert.match(source, /\bclass="[^"]*\bph-no-autocapture\b/, 'all tracked links exclude autocapture');
  assert.ok(dataset.posthogSurface, 'every event has a placement surface');
  assert.ok(href, 'every event has a destination');
  eventsByName.set(dataset.posthogEvent, (eventsByName.get(dataset.posthogEvent) ?? 0) + 1);
}
assert.deepEqual([...eventsByName.keys()].sort(), [...expectedEvents].sort(), 'keep the complete established profile event contract');
const placements = (event, surface) => tracked.filter(({ dataset }) => dataset.posthogEvent === event && dataset.posthogSurface === surface).length;
for (const [event, surface, minimum] of [
  ['resume_downloaded', 'header', 1], ['resume_downloaded', 'hero', 1], ['resume_downloaded', 'career', 1],
  ['newsletter_clicked', 'hero', 1], ['newsletter_clicked', 'writing', 1], ['newsletter_clicked', 'footer', 1],
  ['modepot_project_clicked', 'personal_profile', 4],
  ['email_clicked', 'contact', 1], ['newsletter_subscribe_clicked', 'writing', 1],
]) {
  assert.ok(placements(event, surface) >= minimum, `${event} must remain reported at ${surface}`);
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
const keyboardLink = tracked.find(({ dataset }) => dataset.posthogEvent === 'resume_downloaded');
listeners.click({ target: new Element({ ...keyboardLink, dataset: keyboardLink.dataset }), detail: 0 });
assert.equal(captures.length, 1, 'keyboard-generated primary click records exactly one conversion');
assert.equal(captures[0][0], 'resume_downloaded');
captures.length = 0;
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

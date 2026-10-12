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
  return { source, dataset, href: new URL(attr('href'), 'https://tugrul.modepot.io').href };
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
  URL,
};
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1], context);
assert.equal(typeof listeners.click, 'function');
assert.equal(typeof listeners.auxclick, 'function');

// Execute the exact self-contained sanitizer emitted before SDK initialization.
const sanitizerSource = scripts[0][1].match(/function sanitizePosthogEvent\(event\) \{[\s\S]*?\n    \}/)?.[0];
assert.ok(sanitizerSource, 'sanitizer must be defined before posthog.init');
assert.ok(scripts[0][1].indexOf(sanitizerSource) < scripts[0][1].indexOf('posthog.init('), 'hook must be initialized before SDK init');
const sanitizerContext = { URL, Date };
vm.runInNewContext(`${sanitizerSource}; this.sanitize = sanitizePosthogEvent;`, sanitizerContext);
const stamp = new Date('2026-10-11T12:00:00.000Z');
const privateSentinel = 'PRIVATE_CAMPAIGN_SENTINEL';
const cleanEvent = sanitizerContext.sanitize({
  event: '$pageview', distinct_id: 'public-distinct-id', properties: {
    token: 'phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V', $current_url: 'https://example.com/path?utm_source=PRIVATE_CAMPAIGN_SENTINEL&gclid=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL',
    custom_url: 'https://example.com/cta?fbclid=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL',
    protocol_relative: '//example.org/path?gclid=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL',
    network_name: 'x', $gclid: privateSentinel, $initial_fbc: privateSentinel,
    nested_relative: [{ link: '//example.org/nested?PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL' }],
    nested: [{ renamed: 'https://example.org/route?campaign=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL', $session_entry_utm_source: privateSentinel, wbraid: privateSentinel }],
    $initial_referrer: 'https://ref.example/entry?msclkid=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL',
    timestamp: stamp, api_key: 'PRIVATE_API_SENTINEL', authorization: 'PRIVATE_AUTH_SENTINEL',
    distinct_id: 'preserved-identity', $session_entry_utm_campaign: privateSentinel,
  }, $set: { $initial_utm_source: privateSentinel, campaign_id: privateSentinel },
  $set_once: { $session_exit_url: 'https://exit.example/path?ttclid=PRIVATE_CAMPAIGN_SENTINEL#PRIVATE_CAMPAIGN_SENTINEL' },
});
const serializedCleanEvent = JSON.stringify(cleanEvent);
assert.equal(cleanEvent.properties.network_name, 'x');
assert.equal(cleanEvent.properties.protocol_relative, 'https://example.org/path');
assert.equal(cleanEvent.properties.nested_relative[0].link, 'https://example.org/nested');
assert.equal(cleanEvent.properties.token, 'phc_qXkp5FBQfrqHQwkqf3ys8iSoGoMYw2tpTHXGugXJhP8V', 'public project token survives');
assert.equal(cleanEvent.distinct_id, 'public-distinct-id', 'event identity survives');
assert.equal(cleanEvent.properties.distinct_id, 'preserved-identity', 'nested identity survives');
assert.equal(cleanEvent.properties.timestamp, stamp, 'Date object is preserved');
assert.equal(cleanEvent.properties.$current_url, 'https://example.com/path', 'current URL query and hash stripped');
assert.equal(cleanEvent.properties.custom_url, 'https://example.com/cta', 'URLs sanitized regardless of key');
assert.equal(cleanEvent.properties.nested[0].renamed, 'https://example.org/route', 'nested URL sanitized');
for (const forbidden of ['PRIVATE_CAMPAIGN_SENTINEL', 'PRIVATE_API_SENTINEL', 'PRIVATE_AUTH_SENTINEL']) assert.ok(!serializedCleanEvent.includes(forbidden), `${forbidden} must not leak`);
assert.ok(cleanEvent.$set && cleanEvent.$set_once, 'non-campaign SDK envelope updates survive');

for (const link of tracked) {
  const target = new Element({ ...link, dataset: link.dataset });
  const destination = new URL(link.href);
  const expectedProperties = { surface: link.dataset.posthogSurface, destination: `${destination.origin}${destination.pathname}` };
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
assert.equal(captures.length, 1, 'a click event with detail: 0 records exactly one conversion (unit simulation; not a real keyboard activation)');
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

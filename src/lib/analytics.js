// PostHog analytics (product usage only). Loaded from the PostHog CDN so the app stays no-build.
// Set POSTHOG_KEY below to enable; with an empty key every call is a silent no-op.
// Privacy: no autocapture, no session replay, no person profiles, and no meal/weight data is ever sent.
export const POSTHOG_KEY = 'phc_AwjUVZDL9447Tvk38xMw2FyaEdn6U7xiq5EP8PyTfee3';                            // project API key (phc_...), safe to ship publicly
export const POSTHOG_HOST = 'https://us.i.posthog.com';    // EU projects: https://eu.i.posthog.com
const ASSETS_HOST = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com');

const queue = [];
let ready = false;

function flush() {
  ready = true;
  while (queue.length) { const [name, props] = queue.shift(); window.posthog.capture(name, props); }
}

export function initAnalytics() {
  if (!POSTHOG_KEY || ready || document.querySelector('script[data-posthog]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.dataset.posthog = '';
  s.src = `${ASSETS_HOST}/static/array.js`;
  s.onload = () => {
    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      defaults: '2025-05-24',
      autocapture: false,
      capture_pageview: false,          // SPA: pageviews are sent by the router
      disable_session_recording: true,
      person_profiles: 'identified_only',
      loaded: flush,
    });
  };
  s.onerror = () => { queue.length = 0; };  // offline / blocked: drop silently
  document.head.append(s);
}

export function track(name, props = {}) {
  if (!POSTHOG_KEY) return;
  if (ready) window.posthog.capture(name, props);
  else if (queue.length < 50) queue.push([name, props]);
}

export const trackPageview = (path) => track('$pageview', { $current_url: location.href, path });

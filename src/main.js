import { initAnalytics } from './lib/analytics.js';
import { start } from './lib/router.js';
import { todayScreen } from './screens/today.js';
import { progressScreen } from './screens/progress.js';
import { profileScreen } from './screens/profile.js';

initAnalytics();
start(document.getElementById('app'), {
  '/': { label: 'Today', view: todayScreen },
  '/progress': { label: 'Progress', view: progressScreen },
  '/profile': { label: 'Profile', view: profileScreen },
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch((e) => console.warn('SW registration failed', e));
}

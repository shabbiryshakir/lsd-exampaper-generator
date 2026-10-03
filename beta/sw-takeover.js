// Loaded into the service worker. When a new version replaces an older one, every open copy of
// the app is reloaded into the new version straight away, so nobody stays stuck on an old build
// (even copies running old code that never learned how to update themselves).
let replacingOld = false;
self.addEventListener('install', () => { replacingOld = !!self.registration.active; });
self.addEventListener('activate', (event) => {
  if (!replacingOld) return;
  event.waitUntil(self.clients.claim());
  // Reload only once activation has finished: the reload is served by this worker, so waiting
  // for it inside activation would deadlock.
  setTimeout(() => {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.forEach((c) => c.navigate(c.url).catch(() => {})));
  }, 0);
});

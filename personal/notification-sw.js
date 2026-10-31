self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => window.url.startsWith(self.registration.scope));
    return existing ? existing.focus() : clients.openWindow(self.registration.scope);
  }));
});

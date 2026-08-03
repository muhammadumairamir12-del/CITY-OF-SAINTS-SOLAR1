importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDulYuUV4Km2e67SSzveNl9poq90-EhkU8",
  authDomain: "zigzoog-5708f.firebaseapp.com",
  databaseURL: "https://zigzoog-5708f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "zigzoog-5708f",
  storageBucket: "zigzoog-5708f.firebasestorage.app",
  messagingSenderId: "1072366260486",
  appId: "1:1072366260486:web:fdd7a8c160ff8760ab8e87"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Al-Fazal Hospital';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: payload.notification?.icon || 'logo_small.png',
    image: payload.notification?.image || payload.data?.image || null,
    badge: 'logo_small.png',
    tag: payload.data?.tag || 'alfazal-notif-' + Date.now(),
    data: {
      url: payload.data?.url || '/',
      type: payload.data?.type || 'general',
      notifId: payload.data?.notifId || ''
    },
    actions: [
      { action: 'open', title: '📖 Open' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: (payload.data?.type === 'chat' || payload.data?.type === 'booking_confirmed'),
    silent: false
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  const notifType = event.notification.data?.type || 'general';

  // Redirect based on notification type
  let targetUrl = '/';
  switch(notifType) {
    case 'booking_confirmed':
    case 'booking_cancelled':
    case 'booking_updated':
      targetUrl = '/my-bookings';
      break;
    case 'chat':
      targetUrl = '/consultation';
      break;
    case 'video':
      targetUrl = url || '/';
      break;
    default:
      targetUrl = url || '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data,
            targetUrl: targetUrl
          });
          return;
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Push event handler for direct push (fallback)
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.notification?.title || data.data?.title || 'Al-Fazal Hospital';
      const options = {
        body: data.notification?.body || data.data?.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        data: data.data || {},
        vibrate: [200, 100, 200]
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch(e) {
      console.log('[SW] Push event data parse error:', e);
    }
  }
});
// Service Worker per Meeq - Solo per notifiche push
// NON fa cache offline - tutto deve andare al server locale

const CACHE_NAME = 'meeq-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html'
];

// Installazione - cache solo asset statici base
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installato');
  // Non aspettare, attiva subito
  self.skipWaiting();
});

// Attivazione
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker attivo');
  // Prendi controllo immediato di tutte le pagine
  event.waitUntil(self.clients.claim());
});

// Intercetta richieste - NON cache API, solo asset statici
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Se è una richiesta API, vai sempre al server (no cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Per altri asset, usa cache con fallback a network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// 🆕 GESTIONE NOTIFICHE PUSH
self.addEventListener('push', (event) => {
  console.log('📬 Notifica push ricevuta:', event);
  
  let notificationData = {
    title: 'Nuovo messaggio',
    body: 'Hai ricevuto un nuovo messaggio',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'meeq-message',
    requireInteraction: false,
    data: {}
  };
  
  // Se il payload contiene dati, usali
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        ...notificationData,
        ...payload
      };
    } catch (e) {
      // Se non è JSON, usa come testo
      notificationData.body = event.data.text();
    }
  }
  
  // Mostra la notifica
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'Apri'
        },
        {
          action: 'close',
          title: 'Chiudi'
        }
      ]
    })
  );
});

// 🆕 GESTIONE CLICK SULLA NOTIFICA
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Click su notifica:', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Apri l'app (o la pagina)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se c'è già una finestra aperta, portala in primo piano
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// 🆕 GESTIONE NOTIFICHE CHIUSE
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notifica chiusa:', event);
});



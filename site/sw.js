/* Ferme Konaté — fonctionnement sans réseau : l'application elle-même est gardée sur le téléphone.
   Les données passent par la base (jamais mises en cache ici). */
var VERSION = "ferme-v22";
var COQUILLE = ["./", "index.html", "app.js", "supabase.js", "ferme.jpg", "proprio.jpg", "manifest.webmanifest", "icone-192.png", "icone-512.png", "icone-badge.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(COQUILLE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== VERSION; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (/supabase\.co$/.test(u.hostname)) return;              // données : toujours en direct
  var polices = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !polices) return;
  if (r.mode === "navigate" || /\/(index\.html)?$/.test(u.pathname) || /app\.js$/.test(u.pathname)) {
    // Réseau d'abord (pour recevoir les mises à jour), sinon la copie du téléphone
    e.respondWith(fetch(r).then(function (rep) {
      var copie = rep.clone(); caches.open(VERSION).then(function (c) { c.put(r.mode === "navigate" ? "index.html" : r, copie); });
      return rep;
    }).catch(function () { return caches.match(r.mode === "navigate" ? "index.html" : r).then(function (x) { return x || caches.match("index.html"); }); }));
    return;
  }
  e.respondWith(caches.match(r).then(function (x) {
    return x || fetch(r).then(function (rep) {
      if (rep.ok || rep.type === "opaque") { var copie = rep.clone(); caches.open(VERSION).then(function (c) { c.put(r, copie); }); }
      return rep;
    });
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(function (l) {
    for (var i = 0; i < l.length; i++) if ("focus" in l[i]) return l[i].focus();
    return self.clients.openWindow("./");
  }));
});

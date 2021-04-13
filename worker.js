//importScripts('lib/localforage.min.js');

const CACHE_PREFIX = 'epube';
const CACHE_NAME = CACHE_PREFIX + '-v3';

self.addEventListener('activate', function(event) {
	event.waitUntil(
		caches.keys().then(function(keyList) {
			return Promise.all(keyList.map((key) => {
				if (key.indexOf(CACHE_PREFIX) != -1 && key != CACHE_NAME) {
					return caches.delete(key);
				}
				return false;
			}));
		})
    );
});

function send_message(client, msg) {
	client.postMessage(msg);
}

function send_broadcast(msg) {
	self.clients.matchAll().then((clients) => {
		clients.forEach((client) => {
			send_message(client, msg);
		})
	})
}

self.addEventListener('message', function(event){
	console.log('got message', event.data);

	if (event.data.msg == 'refresh-cache') {
		console.log("refreshing cache...", event);

		send_broadcast('refresh-started');

		return caches.open(CACHE_NAME).then(function(cache) {
			Promise.all(event.data.urls.map(async function(url) {
				const resp = await fetch(url + "?ts=" + Date.now());
				console.log('got', resp.url, resp);
				send_broadcast('refreshed:' + resp.url);
				if (resp.status == 200) {
					return cache.put(url, resp);
				} else if (resp.status == 404) {
					return cache.delete(url);
				}

			})).then(function() {
				console.log('all done');
				send_broadcast('client-reload');
			});
		});
	}
});

this.addEventListener('fetch', function(event) {
	const req = event.request.clone();

	event.respondWith(
		caches.match(req).then(function(resp) {

			if (resp) {
				return resp;
			}

			/*if (!navigator.onLine) {
				if (req.url.match("read.html")) {
					return caches.match("read.html");
				}

				if (req.url.match("offline.html")) {
					return caches.match("offline.html");
				}
			}*/

			console.log('cache miss for', req.url, 'OL:', navigator.onLine);

			return fetch(req).then(function(resp) {

				if (resp.status == 200) {
					if (resp.url.match("backend.php\\?op=(cover|getinfo)")) {
						return caches.open(CACHE_NAME).then(function(cache) {
							cache.put(resp.url, resp.clone());
							return resp;
						});
					}
				}

				return resp;
			}).catch(function() {
				if (req.url[req.url.length-1] == "/" || req.url.match("index.php") || req.url.match("offline.html")) {
					return caches.match("offline.html");
				} else if (req.url.match("read.html")) {
					return caches.match("read.html");
				} else {
					return caches.match(req.url);
				}
			});
		})
	);
});

//importScripts('lib/localforage.min.js');

const CACHE_PREFIX = 'epube';
const CACHE_NAME = CACHE_PREFIX + '-v2';
const CACHE_URLS = [
			'manifest.json',
			'worker.js',
			'img/ic_launcher_web.png?v4',
			'img/favicon.png',
			'read.html',
			'js/app.js',
			'js/reader.js',
			'js/reader_iframe.js',
			'js/dict.js',
			'css/read.css',
			'css/reader.css',
			'css/index.css',
			'css/transitions.css',
			'offline.html',
			'themes/default.css',
			'themes/light.css',
			'themes/mocca.css',
			'themes/night.css',
			'themes/plan9.css',
			'themes/gray.css',
			'themes/sepia.css',
			'lib/promise.js',
			'lib/fetch.js',
			'lib/zip.min.js',
			'lib/epub.js',
			'lib/localforage.min.js',
			'lib/jquery.mobile-events.min.js',
			'lib/holder.min.js',
			'lib/bootstrap/v3/css/bootstrap-theme.min.css',
			'lib/bootstrap/v3/css/bootstrap.min.css',
			'lib/bootstrap/v3/css/theme-dark.min.css',
			'lib/bootstrap/v3/js/jquery.js',
			'lib/bootstrap/v3/js/bootstrap.min.js',
			'lib/bootstrap/v3/fonts/glyphicons-halflings-regular.woff2',
			'lib/fonts/pmn-caecilia-55.ttf',
			'lib/fonts/pmn-caecilia-56.ttf',
			'lib/fonts/pmn-caecilia-75.ttf'
		];

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
	if (event.data == 'refresh-cache') {
		console.log("refreshing cache...");

		send_broadcast('refresh-started');

		return caches.open(CACHE_NAME).then(function(cache) {

			Promise.all(CACHE_URLS.map((url) => {
				return fetch(url + "?ts=" + Date.now()).then((resp) => {
					console.log('got', resp.url, resp);

					send_broadcast('refreshed:' + resp.url);

					if (resp.status == 200) {
						return cache.put(url, resp);
					} else if (resp.status == 404) {
						return cache.delete(url);
					}
				});

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

			if (!navigator.onLine) {
				if (req.url.match("read.html")) {
					return caches.match("read.html");
				}

				if (req.url.match("offline.html")) {
					return caches.match("offline.html");
				}
			}

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
				if (req.url[req.url.length-1] == "/" || req.url.match("index.php")) {
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

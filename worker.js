//importScripts('lib/localforage.min.js');

const CACHE_PREFIX = 'epube';
const CACHE_NAME = CACHE_PREFIX + '-v2';
const CACHE_URLS = [
			'img/ic_launcher_web.png',
			'img/favicon.png',
			'read.html',
			'js/common.js',
			'js/read.js',
			'js/offline.js',
			'js/reader.js',
			'js/dict.js',
			'css/read.css',
			'css/reader.css',
			'css/index.css',
			'css/transitions.css',
			'offline.html',
			'themes/default.css',
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
			'lib/bootstrap/v3/js/jquery.js',
			'lib/bootstrap/v3/js/bootstrap.min.js',
			'lib/bootstrap/v3/fonts/glyphicons-halflings-regular.woff2',
			'lib/fonts/pmn-caecilia-55.ttf',
			'lib/fonts/pmn-caecilia-56.ttf',
			'lib/fonts/pmn-caecilia-75.ttf'
		];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
		return cache.addAll(CACHE_URLS.map((url) => new Request(url, {credentials: 'same-origin'})));
    })
  );
});

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

		caches.open(CACHE_NAME).then(function(cache) {
			const promises = [];

			for (let i = 0; i < CACHE_URLS.length; i++) {

				if (CACHE_URLS[i].match("backend.php"))
					continue;

				const fetch_url = CACHE_URLS[i] + "?ts=" + Date.now();

				const promise = fetch(fetch_url).then(function(resp) {
					const url = new URL(resp.url);
					url.searchParams.delete("ts");

					console.log('got', url);

					if (resp.status == 200) {
						cache.put(url, resp);
					} else if (resp.status == 404) {
						cache.delete(url);
					}
				});

				promises.push(promise);

			}

			Promise.all(promises).then(function() {
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

			if (req.url.match("read.html")) {
				return caches.match("read.html");
			}

			if (req.url.match("offline.html")) {
				return caches.match("offline.html");
			}

			console.log('cache miss for', req.url);

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
				}
			});
		})
	);
});

//importScripts('lib/localforage.min.js');

var CACHE_NAME = 'epube-v1';

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
		var urls = [
			'read.html',
			'js/common.js',
			'js/read.js',
			'js/offline.js',
			'css/read.css',
			'css/index.css',
			'offline.html',
			'lib/zip.min.js',
			'lib/epub.js',
			'lib/localforage.min.js',
			'lib/holder.min.js',
			'lib/smartimages.js',
			'lib/bootstrap/v3/css/bootstrap-theme.min.css',
			'lib/bootstrap/v3/css/bootstrap.min.css',
			'lib/bootstrap/v3/js/jquery.js',
			'lib/bootstrap/v3/js/bootstrap.min.js',
			'lib/bootstrap/v3/fonts/glyphicons-halflings-regular.woff2',
		];

		return cache.addAll(urls.map(url => new Request(url, {credentials: 'same-origin'})));
    })
  );
});

self.addEventListener('message', function(event){
	if (event.data == 'refresh-cache') {
		console.log("refreshing cache...");

		caches.open(CACHE_NAME).then(function(cache) {
			cache.keys().then(function(keys) {
				for (var i = 0; i < keys.length; i++) {

					fetch(keys[i],{credentials:'same-origin'}).then(function(resp) {
						if (resp.status == 200) {
							cache.put(resp.url, resp);
						}
					});

				}
			});
		});
	}
});

this.addEventListener('fetch', function(event) {
	var req = event.request.clone();

	if (!navigator.onLine) {
		event.respondWith(
			caches.match(req).then(function(resp) {

				if (resp) return resp;

				if (req.url.match("read.html")) {
					return caches.match("read.html");
				}

				if (req.url.match("index.php")) {
					return caches.match("offline.html");
				}
			})
		);
	}
});

var CACHE_NAME = 'epube-test';

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
		var urls = [
			'read.html',
			'js/read.js',
			'js/offline.js',
			'css/read.css',
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

this.addEventListener('fetch', function(event) {
	var req = event.request.clone();

	event.respondWith(
		caches.match(req).then(function(resp) {
			if (!navigator.onLine) {

				if (resp) return resp;

				console.log(req.url);

				if (req.url.match("read.html")) {
					return caches.match("read.html");
				}

				if (req.url.match("index.php")) {
					return caches.match("offline.html");
				}
			}

			return fetch(req)
				.then(function(resp) {

				if (req.url.match(/(getlastread|getpagination|\.epub)/)) {
					caches.open(CACHE_NAME).then(function(cache) {
						cache.put(event.request, resp.clone());
					});
				} /*else {
					caches.match(req.url).then(function(cached) {
						if (cached) {
							console.log('refreshing ' + req.url);

							caches.open(CACHE_NAME).then(function(cache) {
								cache.put(event.request, resp.clone());
							});
						}
					});
				} */

				return resp.clone();
			});
		})
	);
});

var CACHE_NAME = "epube-test";

function populate_list() {

	var books = $("#books_container");

	window.caches.open(CACHE_NAME).then(function(cache) {
		cache.keys().then(function(items) {

			$.each(items, function(i, req) {

				if (req.url.match(/\.epub/)) {
					console.log(req.url);


				}

			});

		});
	});

}

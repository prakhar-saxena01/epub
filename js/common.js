function offline_remove(elem, callback) {

	if (confirm("Remove download?")) {

		var id = elem.getAttribute("data-book-id");
		var cacheId = "epube-book." + id;
		var promises = [];

		console.log("offline remove: " + id);

		localforage.iterate(function(value, key, i) {
			if (key.match(cacheId)) {
				promises.push(localforage.removeItem(key));
			}
		});

		Promise.all(promises).then(function() {
			window.setTimeout(function() {
				callback();
			}, 500);
		});
	}
}



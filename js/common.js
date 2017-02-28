$.urlParam = function(name){
	try {
		var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
		return decodeURIComponent(results[1].replace(/\+/g, " ")) || 0;
	} catch (e) {
		return 0;
	}
}

function offline_remove(id, callback) {

	if (confirm("Remove download?")) {

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



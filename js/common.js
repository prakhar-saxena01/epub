'use strict';

$.urlParam = function(name){
	try {
		const results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
		return decodeURIComponent(results[1].replace(/\+/g, " ")) || 0;
	} catch (e) {
		return 0;
	}
}

function offline_remove(id, callback) {

	if (confirm("Remove download?")) {

		const cacheId = "epube-book." + id;
		const promises = [];

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

function init_night_mode() {
	if (window.matchMedia) {
		const mql = window.matchMedia('(prefers-color-scheme: dark)');

		mql.addEventListener("change", () => {
			apply_night_mode(mql.matches);
		});

		apply_night_mode(mql.matches);
	}
}

function apply_night_mode(is_night) {
	console.log("night mode changed to", is_night);

	$("#theme_css").attr("href",
		"lib/bootstrap/v3/css/" + (is_night ? "theme-dark.min.css" : "bootstrap-theme.min.css"));
}

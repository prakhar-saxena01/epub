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

const Cookie = {
	set: function (name, value, lifetime) {
		const d = new Date();
		d.setTime(d.getTime() + lifetime * 1000);
		const expires = "expires=" + d.toUTCString();
		document.cookie = name + "=" + encodeURIComponent(value) + "; " + expires;
	},
	get: function (name) {
		name = name + "=";
		const ca = document.cookie.split(';');
		for (let i=0; i < ca.length; i++) {
			let c = ca[i];
			while (c.charAt(0) == ' ') c = c.substring(1);
			if (c.indexOf(name) == 0) return decodeURIComponent(c.substring(name.length, c.length));
		}
		return "";
	},
	delete: function(name) {
		const expires = "expires=Thu, 01-Jan-1970 00:00:01 GMT";
		document.cookie = name + "=" + "" + "; " + expires;
	}
};

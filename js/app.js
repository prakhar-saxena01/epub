'use strict';

/* global localforage, EpubeApp, $ */

$.urlParam = function(name){
	try {
		const results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
		return decodeURIComponent(results[1].replace(/\+/g, " ")) || 0;
	} catch (e) {
		return 0;
	}
};

/* exported Cookie */
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
		document.cookie = name + "=; " + expires;
	}
};

const App = {
	_dl_progress_timeout: false,
	index_mode: "",
	last_mtime: -1,
	version: "UNKNOWN",
	csrf_token: "",
	init: function() {
		let refreshed_files = 0;

		this.csrf_token = Cookie.get('epube_csrf_token');

		console.log('setting prefilter for token', this.csrf_token);

		$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
			if (originalOptions.type !== 'post' || options.type !== 'post') {
				return;
			}

			const datatype = typeof originalOptions.data;

			if (datatype == 'object')
				options.data = $.param($.extend(originalOptions.data, {"csrf_token": App.csrf_token}));
			else if (datatype == 'string')
				options.data = originalOptions.data + "&csrf_token=" + encodeURIComponent(App.srf_token);

			console.log('>>>', options);
		});

		if (typeof EpubeApp != "undefined") {
			$(".navbar").hide();
			$(".epube-app-filler").show();
			$(".separate-search").show();

			if ($.urlParam("mode") == "favorites")
				EpubeApp.setPage("PAGE_FAVORITES");
			else
				EpubeApp.setPage("PAGE_LIBRARY");
		}

		App.initNightMode();

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', function(event) {

				if (event.data == 'refresh-started') {
					console.log('cache refresh started');
					refreshed_files = 0;

					$(".dl-progress")
						.fadeIn()
						.text("Loading, please wait...");
				}

				if (event.data && event.data.indexOf("refreshed:") == 0) {
					++refreshed_files;

					$(".dl-progress")
						.fadeIn()
						.text("Updated " + refreshed_files + " files...");
				}

				if (event.data == 'client-reload') {
					localforage.setItem("epube.cache-timestamp", App.last_mtime);
					localforage.setItem("epube.cache-version", App.version);
					window.location.reload()
				}

			});

			App.showCovers();
			App.Offline.markBooks();
			App.refreshCache();

		} else {
			$(".container-main")
				.addClass("alert alert-danger")
				.html("Service worker support missing in browser (are you using plain HTTP?).");
		}
	},
	logout: function() {
		$.post("backend.php", {op: "logout"}).then(() => {
			window.location.reload();
		});
	},
	showSummary: function(elem) {
		const id = elem.getAttribute("data-book-id");

		$.post("backend.php", {op: 'getinfo', id: id}, function(data) {

			const comment = data.comment ? data.comment : 'No description available';

			$("#summary-modal .modal-title").html(data.title);
			$("#summary-modal .book-summary").html(comment);

			$("#summary-modal").modal();

		});

		return false;
	},
	showCovers: function() {
		$("img[data-book-id]").each((i,e) => {
			e = $(e);

			if (e.attr('data-cover-link')) {
				const img = $("<img>")
					.on("load", function() {
						e.css("background-image", "url(" + e.attr('data-cover-link') + ")")
							.fadeIn();

						img.attr("src", null);
					})
					.attr("src", e.attr('data-cover-link'));
			} else {
				e.attr('src', 'holder.js/130x190?auto=yes').fadeIn();
			}
		});

		/* global Holder */
		Holder.run();
	},
	toggleFavorite: function(elem) {
		const bookId = elem.getAttribute("data-book-id");

		if (elem.getAttribute("data-is-fav") == "0" || confirm("Remove favorite?")) {

			$.post("backend.php", {op: "togglefav", id: bookId}, function(data) {
				if (data) {
					let msg = "[Error]";

					if (data.status == 0) {
						msg = "Add to favorites";
					} else if (data.status == 1) {
						msg = "Remove from favorites";
					}

					$(elem).html(msg).attr('data-is-fav', data.status);

					if (App.index_mode == "favorites" && data.status == 0) {
						$("#cell-" + bookId).remove();
					}
				}
			});
		}

		return false;
	},
	refreshCache: function(force) {
		if ('serviceWorker' in navigator) {
			localforage.getItem("epube.cache-timestamp").then(function(stamp) {
				console.log('stamp', stamp, 'last mtime', App.last_mtime, 'version', App.version);

				if (force || stamp != App.last_mtime) {
					console.log('asking worker to refresh cache');

					if (navigator.serviceWorker.controller) {
						navigator.serviceWorker.controller.postMessage("refresh-cache");
					} else {
						localforage.getItem("epube.initial-load-done").then(function(done) {

							console.log("initial load done", done);

							if (done) {
								$(".dl-progress")
									.show()
									.addClass("alert-danger")
									.html("Could not communicate with service worker. Try reloading the page.");
							} else {
								localforage.setItem("epube.initial-load-done", true).then(function() {
									$(".dl-progress")
										.show()
										.addClass("alert-info")
										.html("Page will reload to activate service worker...");

									window.setTimeout(function() {
										window.location.reload();
									}, 3*1000);

								});
							}

						});
					}
				}
			});
		} else {
			$(".dl-progress")
				.show()
				.addClass("alert-danger")
				.html("Could not communicate with service worker. Try reloading the page.");
		}
	},
	isOnline: function() {
		if (typeof EpubeApp != "undefined" && typeof EpubeApp.isOnline != "undefined")
			return EpubeApp.isOnline();
		else
			return navigator.onLine;
	},
	appCheckOffline: function() {
		EpubeApp.setOffline(!App.isOnline);
	},
	initNightMode: function() {
		if (typeof EpubeApp != "undefined") {
			App.applyNightMode(EpubeApp.isNightMode());
			return;
		}

		if (window.matchMedia) {
			const mql = window.matchMedia('(prefers-color-scheme: dark)');

			mql.addEventListener("change", () => {
				App.applyNightMode(mql.matches);
			});

			App.applyNightMode(mql.matches);
		}
	},
	applyNightMode: function(is_night) {
		console.log("night mode changed to", is_night);

		$("#theme_css").attr("href",
			"lib/bootstrap/v3/css/" + (is_night ? "theme-dark.min.css" : "bootstrap-theme.min.css"));
	},
	Offline: {
		init: function() {
			if (typeof EpubeApp != "undefined") {
				$(".navbar").hide();
				$(".epube-app-filler").show();

				EpubeApp.setPage("PAGE_OFFLINE");
			}

			App.initNightMode();

			const query = $.urlParam("query");

			if (query)
				$(".search_query").val(query);

			App.Offline.populateList();
		},
		get: function(bookId, callback) {
			console.log("offline cache: " + bookId);

			$.post("backend.php", {op: "getinfo", id: bookId}, function(data) {

				if (data) {
					const cacheId = 'epube-book.' + bookId;

					localforage.setItem(cacheId, data).then(function(data) {

						console.log(cacheId + ' got data');

						const promises = [];

						promises.push(fetch('backend.php?op=download&id=' + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
							if (resp.status == 200) {
								console.log(cacheId + ' got book');

								callback();

								localforage.setItem(cacheId + '.book', resp.blob());
							}
						}));

						promises.push(fetch("backend.php?op=getpagination&id=" + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
							if (resp.status == 200) {
								console.log(cacheId + ' got pagination');

								resp.text().then(function(text) {
									localforage.setItem(cacheId + '.locations', JSON.parse(text));
								});
							}
						}));

						promises.push(fetch("backend.php?op=getlastread&id=" + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
							if (resp.status == 200) {
								console.log(cacheId + ' got lastread');
								resp.text().then(function(text) {
									localforage.setItem(cacheId + '.lastread', JSON.parse(text));
								});
							}
						}));

						if (data.has_cover) {

							promises.push(fetch("backend.php?op=cover&id=" + bookId, {credentials: 'same-origin'}).then(function(resp) {

								if (resp.status == 200) {
									console.log(cacheId + ' got cover');
									localforage.setItem(cacheId + '.cover', resp.blob());
								}

							}));

						}

						Promise.all(promises).then(function() {
							$(".dl-progress")
								.show()
								.html("Finished downloading <b>" + data.title + "</b>");

							window.clearTimeout(App._dl_progress_timeout);

							App._dl_progress_timeout = window.setTimeout(function() {
								$(".dl-progress").fadeOut();
							}, 5*1000);
						});
					});
				}
			});
		},
		getAll: function() {
			if (confirm("Download all books on this page?")) {

				$(".row > div").each(function (i, row) {
					const bookId = $(row).attr("id").replace("cell-", "");
					const dropitem = $(row).find(".offline_dropitem")[0];

					if (bookId) {

						const cacheId = 'epube-book.' + bookId;
						localforage.getItem(cacheId).then(function(book) {

							if (!book) {
								App.Offline.get(bookId, function() {
									App.Offline.mark(dropitem);
								});
							}

						});

					}
				});
			}
		},
		markBooks: function() {
			const elems = $(".offline_dropitem");

			$.each(elems, function (i, elem) {
				App.Offline.mark(elem);
			});
		},
		mark: function(elem) {
			const bookId = elem.getAttribute("data-book-id");
			const cacheId = "epube-book." + bookId;

			localforage.getItem(cacheId).then(function(book) {
				if (book) {
					elem.onclick = function() {
						App.Offline.remove(bookId, function() {
							App.Offline.mark(elem);
						});
						return false;
					};

					elem.innerHTML = "Remove offline data";

				} else {
					elem.onclick = function() {
						App.Offline.get(bookId, function() {
							App.Offline.mark(elem);
						});
						return false;
					};

					elem.innerHTML = "Make available offline";
				}
			});
		},

		removeFromList: function(elem) {
			const bookId = elem.getAttribute("data-book-id");

			return App.Offline.remove(bookId, function() {
				$("#cell-" + bookId).remove();
			});
		},
		remove: function(id, callback) {
			if (confirm("Remove download?")) {

				const cacheId = "epube-book." + id;
				const promises = [];

				console.log("offline remove: " + id);

				localforage.iterate(function(value, key /*, i */) {
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
		},
		search: function() {
			const query = $(".search_query").val();

			localforage.setItem("epube.search-query", query).then(function() {
				App.Offline.populateList();
			});

			return false;
		},
		removeAll: function() {
			if (confirm("Remove all downloaded books?")) {

				const promises = [];

				localforage.iterate(function(value, key/*, i*/) {

					if (key.match("epube-book")) {
						promises.push(localforage.removeItem(key));
					}
				});

				Promise.all(promises).then(function() {
					window.setTimeout(function() {
						App.Offline.populateList();
					}, 500);
				});
			}
		},
		showSummary: function(elem) {
			const bookId = elem.getAttribute("data-book-id");

			localforage.getItem("epube-book." + bookId).then(function(data) {

				const comment = data.comment ? data.comment : 'No description available';

				$("#summary-modal .modal-title").html(data.title);
				$("#summary-modal .book-summary").html(comment);

				$("#summary-modal").modal();

			});

			return false;
		},
		populateList: function() {
			let query = $.urlParam("query");

			if (query) query = query.toLowerCase();

			const books = $("#books_container");
			books.html("");

			localforage.iterate(function(value, key/*, i*/) {
				if (key.match(/epube-book\.\d{1,}$/)) {

					Promise.all([
						localforage.getItem(key),
						localforage.getItem(key + ".cover"),
						localforage.getItem(key + ".lastread"),
						localforage.getItem(key + ".book")
					]).then(function(results) {

						if (results[0] && results[3]) {
							const info = results[0];

							if (query) {
								const match =
									(info.series_name && info.series_name.toLowerCase().match(query)) ||
									(info.title && info.title.toLowerCase().match(query)) ||
									(info.author_sort && info.author_sort.toLowerCase().match(query));

								if (!match) return;
							}


							let cover = false;

							if (results && results[1]) {
								cover = URL.createObjectURL(results[1]);
							}

							let in_progress = false;
							let is_read = false;

							const lastread = results[2];
							if (lastread) {
								in_progress = lastread.page > 0;
								is_read = lastread.total > 0 && lastread.total - lastread.page < 5;
							}

							const thumb_class = is_read ? "read" : "";
							const title_class = in_progress ? "in_progress" : "";

							const series_link = info.series_name ? `<div><a class="series_link" href="#">${info.series_name + " [" + info.series_index + "]"}</a></div>` : "";

							const cell = $(`<div class="col-xxs-6 col-xs-4 col-sm-3 col-md-2" id="cell-${info.id}">
							<a class="thumbnail ${thumb_class}" href="read.html?id=${info.epub_id}&b=${info.id}">
								<img style="display : none">
							</a>
							<div class="caption">
								<div><a class="${title_class}" href="read.html?id=${info.epub_id}&b=${info.id}">${info.title}</a></div>
								<div><a class="author_link" href="#">${info.author_sort}</a></div>
								${series_link}
							</div>
							<div class="dropdown" style="white-space : nowrap">
								<a href="#" data-toggle="dropdown" role="button">More...<span class="caret"></span></a>
								<ul class="dropdown-menu">
									<li><a href="#" data-book-id="${info.id}" onclick="return App.Offline.showSummary(this)">Summary</a></li>
									<li><a href="#" data-book-id="${info.id}" onclick="App.Offline.removeFromList(this)">Remove offline data</a></li>
								</ul>
							</div>
						</div>`);

							if (cover) {
								cell.find("img")
									.css("background-image", "url(" + cover + ")")
									.fadeIn();
							} else {
								cell
									.find("img").attr("data-src", 'holder.js/130x190?auto=yes')
									.fadeIn();
							}

							cell.find(".series_link")
								.attr("title", info.series_name + " [" + info.series_index  + "]")
								.attr("href", "offline.html?query=" + encodeURIComponent(info.series_name));

							cell.find(".author_link")
								.attr("title", info.author_sort)
								.attr("href", "offline.html?query=" + encodeURIComponent(info.author_sort));

							books.append(cell);

							Holder.run();
						}
					});
				}
			});
		}
	},
};

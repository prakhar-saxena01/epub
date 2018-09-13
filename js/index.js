'use strict';

var _dl_progress_timeout;

function cache_refresh(force) {
	if ('serviceWorker' in navigator) {
		localforage.getItem("epube.cache-timestamp").then(function(stamp) {
			var ts = parseInt(new Date().getTime()/1000);

			if (force || !stamp || ts - stamp > 3600 * 24 * 7) {
				console.log('asking worker to refresh cache');
				navigator.serviceWorker.controller.postMessage("refresh-cache");
				localforage.setItem("epube.cache-timestamp", ts);
			}

		});
	}

	return false;
}

function toggle_fav(elem) {
	var bookId = elem.getAttribute("data-book-id");

	if (elem.getAttribute("data-is-fav") == "0" || confirm("Remove favorite?")) {

		$.post("backend.php", {op: "togglefav", id: bookId}, function(data) {
			if (data) {
				var msg = "[Error]";

				if (data.status == 0) {
					msg = "Add to favorites";
				} else if (data.status == 1) {
					msg = "Remove from favorites";
				}

				$(elem).html(msg).attr('data-is-fav', data.status);

				if (index_mode == "favorites" && data.status == 0) {
					$("#cell-" + bookId).remove();
				}
			}
		});
	}

	return false;
}

function mark_offline(elem) {

	var bookId = elem.getAttribute("data-book-id");
	var cacheId = "epube-book." + bookId;

	localforage.getItem(cacheId).then(function(book) {
		if (book) {
			elem.onclick = function() {
				offline_remove(bookId, function() {
					mark_offline(elem);
				});
				return false;
			};

			elem.innerHTML = "Remove offline data";


		} else {
			elem.onclick = function() {
				offline_cache(bookId, function() {
					mark_offline(elem);
				});
				return false;
			};

			elem.innerHTML = "Make available offline";
		}
	});
}

function mark_offline_books() {
	var elems = $(".offline_dropitem");

	$.each(elems, function (i, elem) {
		mark_offline(elem);
	});
}

function offline_cache(bookId, callback) {
	console.log("offline cache: " + bookId);

	$.post("backend.php", {op: "getinfo", id: bookId}, function(data) {

		if (data) {
			var cacheId = 'epube-book.' + bookId;

			localforage.setItem(cacheId, data).then(function(data) {

				console.log(cacheId + ' got data');

				var promises = [];

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

					window.clearTimeout(_dl_progress_timeout);

					_dl_progress_timeout = window.setTimeout(function() {
						$(".dl-progress").fadeOut();
					}, 5*1000);
				});
			});
		}

	});
}

function show_summary(elem) {
	var id = elem.getAttribute("data-book-id");

	$.post("backend.php", {op: 'getinfo', id: id}, function(data) {

		var comment = data.comment ? data.comment : 'No description available';

		$("#summary-modal .modal-title").html(data.title);
		$("#summary-modal .book-summary").html(comment);

		$("#summary-modal").modal();

	});

	return false;
}

function offline_get_all() {

	if (confirm("Download all books on this page?")) {

		$(".index_cell").each(function (i, row) {
			var bookId = $(row).attr("id").replace("cell-", "");
			var dropitem = $(row).find(".offline_dropitem")[0];

			if (bookId) {

				var cacheId = 'epube-book.' + bookId;
				localforage.getItem(cacheId).then(function(book) {

					if (!book) {
						offline_cache(bookId, function() {
							mark_offline(dropitem);
						});
					}

				});

			}
		});
	}

}


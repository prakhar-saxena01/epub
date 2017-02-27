function cache_refresh() {
	if ('serviceWorker' in navigator) {
		localforage.getItem("epube.cache-timestamp").then(function(stamp) {
			var ts = parseInt(new Date().getTime()/1000);

			if (!stamp || ts - stamp > 3600) {
				console.log('asking worker to refresh cache');
				navigator.serviceWorker.controller.postMessage("refresh-cache");
				localforage.setItem("epube.cache-timestamp", ts);
			}

		});
	}
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
			};

			elem.innerHTML = "Remove offline data";


		} else {
			elem.onclick = function() {
				offline_cache(bookId, function() {
					mark_offline(elem);
				});
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

				fetch('backend.php?op=download&id=' + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
					if (resp.status == 200) {
						console.log(cacheId + ' got book');

						callback();

						localforage.setItem(cacheId + '.book', resp.blob());
					}
				});

				fetch("backend.php?op=getpagination&id=" + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
					if (resp.status == 200) {
						console.log(cacheId + ' got pagination');

						resp.text().then(function(text) {
							localforage.setItem(cacheId + '.pagination', JSON.parse(text));
						});
					}
				});

				fetch("backend.php?op=getlastread&id=" + data.epub_id, {credentials: 'same-origin'}).then(function(resp) {
					if (resp.status == 200) {
						console.log(cacheId + ' got lastread');
						resp.text().then(function(text) {
							localforage.setItem(cacheId + '.lastread', JSON.parse(text));
						});
					}
				});

				if (data.has_cover) {

					fetch("backend.php?op=cover&id=" + bookId, {credentials: 'same-origin'}).then(function(resp) {

						if (resp.status == 200) {
							console.log(cacheId + ' got cover');
							localforage.setItem(cacheId + '.cover', resp.blob());
						}

					});

				}

			});
		}

	});
}

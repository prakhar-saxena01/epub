'use strict';

/* global localforage, Holder */

/* exported offline_search */
function offline_search() {
	const query = $(".search_query").val();

	localforage.setItem("epube.search-query", query).then(function() {
		populate_list();
	});

	return false;
}

/* exported offline_remove2 */
function offline_remove2(elem) {
	const bookId = elem.getAttribute("data-book-id");

	/* global offline_remove */
	return offline_remove(bookId, function() {
		$("#cell-" + bookId).remove();
	});
}

/* exported offline_clear */
function offline_clear() {

	if (confirm("Remove all downloaded books?")) {

		const promises = [];

		localforage.iterate(function(value, key/*, i*/) {

			if (key.match("epube-book")) {
				promises.push(localforage.removeItem(key));
			}
		});

		Promise.all(promises).then(function() {
			window.setTimeout(function() {
				populate_list();
			}, 500);
		});
	}
}


function populate_list() {

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

					const cell = $(`<div class="col-xs-6 col-sm-3 col-md-2" id="cell-${info.id}">
							<div class="thumbnail ${thumb_class}">
								<a href="read.html?id=${info.epub_id}&b=${info.id}">
									<img style="display : none">
								</a>
							</div>
							<div class="caption">
								<div><a class="${title_class}" href="read.html?id=${info.epub_id}&b=${info.id}">${info.title}</a></div>
								<div><a class="author_link" href="#">${info.author_sort}</a></div>
								${series_link}
							</div>
							<div class="dropdown" style="white-space : nowrap">
								<a href="#" data-toggle="dropdown" role="button">More...<span class="caret"></span></a>
								<ul class="dropdown-menu">
									<li><a href="#" data-book-id="${info.id}" onclick="return show_summary(this)">Summary</a></li>
									<li><a href="#" data-book-id="${info.id}" onclick="offline_remove2(this)">Remove offline data</a></li>
								</ul>
							</div>
						</div>`);

					if (cover) {

						cell.find("img")
							.css("background-image", "url(" + cover + ")")
							.fadeIn();

						cell.find(".series_link")
							.attr("title", info.series_name + " [" + info.series_index  + "]")
							.attr("href", "offline.html?query=" + encodeURIComponent(info.series_name));

						cell.find(".author_link")
							.attr("title", info.author_sort)
							.attr("href", "offline.html?query=" + encodeURIComponent(info.author_sort));

					}

					books.append(cell);

					Holder.run();
				}
			});
		}
	});

}

/* exported show_summary */
function show_summary(elem) {
	const bookId = elem.getAttribute("data-book-id");

	localforage.getItem("epube-book." + bookId).then(function(data) {

		const comment = data.comment ? data.comment : 'No description available';

		$("#summary-modal .modal-title").html(data.title);
		$("#summary-modal .book-summary").html(comment);

		$("#summary-modal").modal();

	});

	return false;
}

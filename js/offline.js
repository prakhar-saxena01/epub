function offline_remove2(elem) {
	var bookId = elem.getAttribute("data-book-id");

	return offline_remove(bookId, function() {
		$("#cell-" + bookId).remove();
	});
}

function offline_clear() {

	if (confirm("Remove all offline data?")) {

		var promises = [];

		localforage.iterate(function(value, key, i) {

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

	var books = $("#books_container");
	books.html("");

	localforage.iterate(function(value, key, i) {
		if (key.match(/epube-book\.\d{1,}$/)) {

			Promise.all([
				localforage.getItem(key),
				localforage.getItem(key + ".cover"),
				localforage.getItem(key + ".lastread"),
				localforage.getItem(key + ".book")
			]).then(function(results) {

				if (results[0] && results[3]) {
					var info = results[0];
					var cover = false;

					if (results && results[1]) {
						cover = URL.createObjectURL(results[1]);
					}

					var in_progress = false;
					var is_read = false;

					var lastread = results[2];
					if (lastread) {

						in_progress = lastread.page > 0;
						is_read = lastread.total > 0 && lastread.total - lastread.page < 5;
					}

					var cell = "<div class='col-xs-6 col-sm-3 col-md-2 index_cell' id=\"cell-"+info.id+"\">";

					var cover_read = is_read ? "read" : "";
					var title_class = in_progress ? "in_progress" : "";

					cell += "<div class=\"thumb "+cover_read+"\">";
					cell += "<a href=\"read.html?id="+info.epub_id+"&b="+info.id+"\"><img data-src=\"holder.js/120x180\"></a>";

					cell += "<div class=\"caption\">";
					cell += "<div><a class=\""+title_class+"\" href=\"read.html?id="+info.epub_id+"&b="+info.id+"\">" +
						info.title + "</a></div>";
					cell += "<div>" + info.author_sort + "</div>";

					if (info.series_name) {
						cell += "<div>" + info.series_name + " [" + info.series_index + "]</div>";
					}

					cell += "</div>";

					cell += "<div class=\"dropdown\" style=\"white-space : nowrap\">";
					cell += "<a href=\"#\" data-toggle=\"dropdown\" role=\"button\">" +
						"More..." + "<span class=\"caret\"></span></a>";

					cell += "<ul class=\"dropdown-menu\">";
					cell += "<li><a href=\"#\" data-book-id=\""+info.id+"\" onclick=\"offline_remove2(this)\">Remove offline data</a></li>";
					cell += "</ul>";

					cell += "</div>";

					cell += "</div>";
					cell += "</div>";

					var cell = $(cell);

					if (cover) {
						cell.find("img").attr("src", cover);
					}

					books.append(cell);

					Holder.run();
				}
			});
		}
	});
}

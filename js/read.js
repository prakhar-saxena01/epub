var _store_position = 0;

function next_page() {
	_store_position = 1;

	window.book.nextPage();
}

function prev_page() {
	window.book.prevPage();
}

function hotkey_handler(e) {
	try {
		//console.log('K:' + e.which);

		if ($(".modal").is(":visible"))
			return;

		// right
		if (e.which == 39) {
			e.preventDefault();
			next_page();
		}

		// left
		if (e.which == 37) {
			e.preventDefault();;
			prev_page();
		}

	} catch (e) {
		console.warn(e);
	}
}

function init_taps() {
	try {
		window.addEventListener("mouseup",
			function(event) {
				if (event.button == 0) {

					if ($(".modal").is(":visible"))
						return;

					var doc = document.documentElement;
					var margin_x = 64;
					var margin_y_top = 48;
					var margin_y_bottom = 48;

					//console.log(event.clientY + " " + doc.clientHeight);

					if (event.clientY < margin_y_top || event.clientY >= doc.clientHeight - margin_y_bottom) {
						return;
					}

					if (event.clientX >= doc.clientWidth - margin_x) {
						console.log("RIGHT SIDE");
						next_page();
					}

					if (event.clientX <= margin_x) {
						console.log("LEFT SIDE");
						prev_page();
					}
				}
			}
		);
	} catch (e) {
		console.warn(e);
	}
}

function apply_line_height(elem) {
	var height = elem[elem.selectedIndex].value;

	localforage.setItem("epube.lineHeight", height);

	window.book.setStyle("lineHeight", height + "%");

}

function apply_font(elem) {
	var font = elem[elem.selectedIndex].value;

	localforage.setItem("epube.fontFamily", font);

	window.book.setStyle("fontFamily", font);

}

function apply_font_size(elem) {
	var size = elem[elem.selectedIndex].value;

	localforage.setItem("epube.fontSize", size);
	window.book.setStyle("fontSize", size + "px");

}

function clear_lastread() {
	if (confirm("Clear stored last read location?")) {
		var total = window.book.pagination.totalPages;

		if (navigator.onLine) {
			$.post("backend.php", { op: "storelastread", page: -1, cfi: "", id: $.urlParam("id") }, function(data) {
				$(".lastread_input").val(data.page);
			});
		}

		localforage.setItem(cacheId("lastread"),
			{cfi: "", page: 0, total: total});

	}
}

function mark_as_read() {
	if (confirm("Mark book as read?")) {
		var total = window.book.pagination.totalPages;
		var lastCfi = book.pagination.cfiFromPage(total);

		if (navigator.onLine) {
			$.post("backend.php", { op: "storelastread", page: total, cfi: lastCfi, id: $.urlParam("id") }, function(data) {
				$(".lastread_input").val(data.page);
			});
		}

		localforage.setItem(cacheId("lastread"),
			{cfi: lastCfi, page: total, total: total});

	}
}

function save_and_close() {
	var currentPage = book.pagination.pageFromCfi(book.getCurrentLocationCfi());
	var currentCfi = book.getCurrentLocationCfi();
	var totalPages = book.pagination.totalPages;

	localforage.setItem(cacheId("lastread"),
		{cfi: currentCfi, page: currentPage, total: totalPages});

	if (navigator.onLine) {
		$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
			cfi: currentCfi }, function(data) {
				window.location = "index.php";
			});
	} else {
		window.location = "index.php";
	}
}

function toggle_night_mode() {
	localforage.getItem("epube.night_mode").then(function(night) {
		night = !night;

		localforage.setItem("epube.night_mode", night).then(function() {
			apply_night_mode();
		});

	});
}

function apply_night_mode() {
	localforage.getItem("epube.night_mode").then(function(night) {
		if (night) {

			window.book.setStyle("background", "black");
			window.book.setStyle("color", "#ccc");

			$("body").addClass("night");

		} else {

			window.book.setStyle("background", "white");
			window.book.setStyle("color", "black");

			$("body").removeClass("night");
		}
	});
}

function search() {
	var query = $(".search_input").val();
	var list = $(".search_results");

	list.html("");

	if (query) {
		var results = window.book.currentChapter.find(query);

		$.each(results, function (i, row) {
			var a = $("<a>")
				.attr('href', '#')
				.html(row.excerpt +
					" <b>(Loc.&nbsp;" + window.book.pagination.pageFromCfi(row.cfi) + ")</b>")
				.attr('data-cfi', row.cfi)
				.attr('data-id', row.id)
				.click(function() {
						window.book.gotoCfi(a.attr('data-cfi'));
				});

			list.append($("<li>").append(a));

		});
	}
}

function toggle_transitions(elem) {
	localforage.setItem("epube.disable-transitions", elem.checked);
}

function dict_lookup(word, callback) {
	$.post("backend.php", {op: 'define', word: word}, function(data) {
		if (data) {

			$(".dict_result").html(data.result.join("<br/>"));
			$("#dict-modal").modal('show');

			if (callback) callback();
		}
	});
}



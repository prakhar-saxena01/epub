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
		console.log('K:' + e.which);

		// right
		if (e.which == 39) {
			next_page();
		}

		// left
		if (e.which == 37) {
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

function lmargin(incr) {
	var cur = parseInt(window.book.settings.styles.lineHeight.replace("%", ""));
	var size = cur + incr;

	localStorage["epube:lineHeight"] = size;

	window.book.setStyle("lineHeight", size + "%");

}

function apply_font(elem) {
	var font = elem[elem.selectedIndex].value;

	localStorage["epube:fontFamily"] = font;

	window.book.setStyle("fontFamily", font);

}
function zoom(incr) {
	var cur = parseInt(window.book.settings.styles.fontSize.replace("px", ""));
	var size = cur + incr;

	localStorage["epube:fontSize"] = size;

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
	if (navigator.onLine) {
		var currentPage = book.pagination.pageFromCfi(book.getCurrentLocationCfi());
		var currentCfi = book.getCurrentLocationCfi();
		var totalPages = book.pagination.totalPages;

		localforage.setItem(cacheId("lastread"),
			{cfi: currentCfi, page: currentPage, total: totalPages});

		$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
			cfi: currentCfi }, function(data) {
				window.location = "index.php";
			});
	} else {
		window.location = "index.php";
	}
}

function invert() {
	localStorage["night_mode"] = localStorage["night_mode"] == "0" ? 1 : 0;

	apply_night_mode();
}

function apply_night_mode() {
	if (localStorage["night_mode"] == "1") {
		window.book.setStyle("background", "black");
		window.book.setStyle("color", "#ccc");

		$("body").css("background", "black");

	} else {
		window.book.setStyle("background", "white");
		window.book.setStyle("color", "black");

		$("body").css("background", "white");

	}
}

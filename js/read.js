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
					var margin_x = 45;
					var margin_y_top = 40;
					var margin_y_bottom = 60;

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

	$.post("backend.php", { op: "setsetting", key: "lineHeight", value: size });

	window.book.setStyle("lineHeight", size + "%");

}

function apply_font(elem) {
	var font = elem[elem.selectedIndex].value;

	$.post("backend.php", { op: "setsetting", key: "fontFamily", value: font });

	window.book.setStyle("fontFamily", font);

}
function zoom(incr) {
	var cur = parseInt(window.book.settings.styles.fontSize.replace("px", ""));
	var size = cur + incr;

	$.post("backend.php", { op: "setsetting", key: "fontSize", value: size });

	window.book.setStyle("fontSize", size + "px");

}

function clear_lastread() {
	if (confirm("Clear stored last read page?")) {
		var bookId = book.generateBookKey(book.metadata.identifier);

		$.post("backend.php", { op: "storelastread", page: -1, id: bookId }, function(data) {
			$(".lastread_input").val(data);
		});
	}
}

'use strict';

var _store_position = 0;
var _enable_fullscreen = 0;

function request_fullscreen() {
	if (_enable_fullscreen)
		document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
}

function disable_fullscreen() {
	document.webkitExitFullscreen();
}

function show_ui(show) {
	if (show)
		$(".header,.footer").fadeIn();
	else
		$(".header,.footer").fadeOut();
}

function toggle_ui() {
	if ($(".header").is(":visible"))
		$(".header,.footer").fadeOut();
	else
		$(".header,.footer").fadeIn();
}

function open_lastread() {
	localforage.getItem(cacheId("lastread")).then(function(item) {
		console.log('lr local', item);

		item = item || {};

		if (item.cfi) book.gotoCfi(item.cfi);

		if (navigator.onLine) {

			$.post("backend.php", { op: "getlastread", id: $.urlParam("id") }, function(data) {
				console.log('lr remote', data);

				if (navigator.onLine && data) {
					localforage.setItem(cacheId("lastread"),
						{cfi: data.cfi, page: data.page, total: data.total});

					if (item.cfi != data.cfi && (!item.page || data.page > item.page))
						book.gotoCfi(data.cfi);

				}
			});
		}

	});
}

function next_page() {
	_store_position = 1;

	window.book.nextPage();

	show_ui(false);
	request_fullscreen();
}

function prev_page() {
	window.book.prevPage();

	show_ui(false);
	request_fullscreen();
}

function hotkey_handler(e) {
	try {
		//console.log('K:' + e.which);

		if ($(".modal").is(":visible"))
			return;

		// right or space
		if (e.which == 39 || e.which == 32) {
			e.preventDefault();
			next_page();
		}

		// left
		if (e.which == 37) {
			e.preventDefault();
			prev_page();
		}

		// esc
		if (e.which == 27) {
			e.preventDefault();
			show_ui(true);
		}


	} catch (e) {
		console.warn(e);
	}
}

$(document).ready(function() {
	document.onkeydown = hotkey_handler;

	$(window).on("orientationchange", function(evt) {
		console.log("orientationchange");

		$(".loading").show();
		$(".loading_message").html("Opening chapter...");

		window.setTimeout(function() {
			open_lastread();

			window.setTimeout(function() {
				$(".loading").hide();
			}, 500);

		}, 1000);
	});

	$(window).on("mouseup", function(evt) {
		if (evt.button == 0) {

			if ($(".modal").is(":visible"))
					return;

			var doc = document.documentElement;
			var margin_x = 64;
			var margin_y_top = 48;
			var margin_y_bottom = 48;

			//console.log(event.clientY + " " + doc.clientHeight);

			if (evt.clientY < margin_y_top || evt.clientY >= doc.clientHeight - margin_y_bottom) {
				return;
			}

			if (evt.clientX >= doc.clientWidth - margin_x) {
				console.log("RIGHT SIDE");
				next_page();
			} else if (evt.clientX <= margin_x) {
				console.log("LEFT SIDE");
				prev_page();
			}
		}
	});
});

function apply_line_height(elem) {
	var height = elem[elem.selectedIndex].value;

	localforage.setItem("epube.lineHeight", height).then(function() {
		apply_styles();
	});
}

function apply_font(elem) {
	var font = elem[elem.selectedIndex].value;

	localforage.setItem("epube.fontFamily", font).then(function() {
		apply_styles();
	});

}

function apply_font_size(elem) {
	var size = elem[elem.selectedIndex].value;

	localforage.setItem("epube.fontSize", size).then(function() {
		apply_styles();
	});
}

function apply_styles() {

	Promise.all([
		localforage.getItem("epube.fontSize"),
		localforage.getItem("epube.fontFamily"),
		localforage.getItem("epube.lineHeight"),
		localforage.getItem("epube.theme")
	]).then(function(res) {
		var fontSize = res[0] ? res[0] + "px" : DEFAULT_FONT_SIZE + "px";
		var fontFamily = res[1] ? res[1] : DEFAULT_FONT_FAMILY;
		var lineHeight = res[2] ? res[2] + "%" : DEFAULT_LINE_HEIGHT + "%";
		var themeName = res[3] ? res[3] : false;

		book.setStyle("fontSize", fontSize);
		book.setStyle("fontFamily", fontFamily);
		book.setStyle("lineHeight", lineHeight);
		book.setStyle("textAlign", "justify");

/*		$("#reader iframe").contents().find("p")
			.css("background", "")
			.css("color", "")
			.css("background-color", "")
			.css("font-family", fontFamily)
			.css("font-size", fontSize)
			.css("line-height", lineHeight)
			.css("text-align", "justify"); */

	});

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

function change_theme(elem) {
	var theme = $(elem).val();
	localforage.setItem("epube.theme", theme).then(function() {
		apply_theme();
	});
}

function apply_theme() {
	localforage.getItem("epube.theme").then(function(theme) {
		console.log('theme', theme);

		var baseUrl = window.location.href.match(/^.*\//)[0];

		if (!theme)
			theme = 'default';
		else
			theme = theme.replace("/", "");

		var themeUrl = baseUrl + "themes/" + theme + ".css";

		$("#theme_css").attr("href", themeUrl);
		$(book.renderer.doc).find("#theme_css").attr('href', themeUrl);

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

function dict_lookup(word, callback) {
	$.post("backend.php", {op: 'define', word: word}, function(data) {
		if (data) {

			$(".dict_result").html(data.result.join("<br/>"));
			$(".dict_query").val(word);
			$("#dict-modal").modal('show');

			if (callback) callback();
		}
	});
}



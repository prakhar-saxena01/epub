'use strict';

/* global localforage, book, cacheId */

function toggle_fullscreen() {
	const element = document.documentElement;
	const isFullscreen = document.webkitIsFullScreen || document.mozFullScreen || false;

	element.requestFullScreen = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen ||
		function () { return false; };

	document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen ||
		function () { return false; };

	isFullscreen ? document.cancelFullScreen() : element.requestFullScreen();
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

		// CFI missing or w/e
		try {

			// this is ridiculous tbh
			if (item.cfi) book.rendition.display(item.cfi).then(() => {
				book.rendition.display(item.cfi);
			});

		} catch (e) {
			console.warn(e);
		}

		if (navigator.onLine) {

			$.post("backend.php", { op: "getlastread", id: $.urlParam("id") }, function(data) {
				console.log('lr remote', data);

				if (navigator.onLine && data) {
					localforage.setItem(cacheId("lastread"),
						{cfi: data.cfi, page: data.page, total: data.total});

					try {
						if (item.cfi != data.cfi && (!item.page || data.page >= item.page))
							console.log('using remote lastread...');

							book.rendition.display(data.cfi).then(() => {
								book.rendition.display(data.cfi);
							});
					} catch (e) {
						console.warn(e);
					}

				}
			})
			.fail(function(e) {
				if (e && e.status == 401) {
					window.location = "index.php";
				}
			});
		}

	});
}

function next_page() {
	_store_position = 1;

	window.book.rendition.next();

	localforage.getItem("epube.keep-ui-visible").then(function(keep) {
		if (!keep) show_ui(false);
	});
}

function prev_page() {
	window.book.rendition.prev();

	localforage.getItem("epube.keep-ui-visible").then(function(keep) {
		if (!keep) show_ui(false);
	});
}

function hotkey_handler(e) {
	try {
		//console.log('K3:' + e.which, e);

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

function resize_side_columns() {
	let width = $("#reader").position().left;
	const iframe = $("#reader iframe")[0];

	if (iframe && iframe.contentWindow.$)
		width += parseInt(iframe.contentWindow.$("body").css("padding-left"));

	$("#left, #right").width(width);
}

$(document).ready(function() {
	$(document).on("keyup", function(e) {
		hotkey_handler(e);
	});

	$("#left").on("mouseup", function() {
		prev_page();
	});

	$("#right").on("mouseup", function() {
		next_page();
	});

});

function apply_line_height(elem) {
	const height = $(elem).val();

	localforage.setItem("epube.lineHeight", height).then(function() {
		apply_styles();
	});
}

function apply_font(elem) {
	const font = $(elem).val();

	localforage.setItem("epube.fontFamily", font).then(function() {
		apply_styles();
	});

}

function apply_font_size(elem) {
	const size = $(elem).val();

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
		const fontSize = res[0] ? res[0] + "px" : DEFAULT_FONT_SIZE + "px";
		const fontFamily = res[1] ? res[1] : DEFAULT_FONT_FAMILY;
		const lineHeight = res[2] ? res[2] + "%" : DEFAULT_LINE_HEIGHT + "%";
		//const themeName = res[3] ? res[3] : false;

		$.each(window.book.rendition.getContents(), function(i, c) {
			c.css("font-size", fontSize);
			c.css("font-family", fontFamily);
			c.css("line-height", lineHeight);
		});

		apply_theme();
	});

}

function clear_lastread() {
	if (confirm("Clear stored last read location?")) {
		const total = window.book.locations.length();

		if (navigator.onLine) {
			$.post("backend.php", { op: "storelastread", page: -1, cfi: "", id: $.urlParam("id") }, function(data) {
				$(".lastread_input").val(data.page + '%');
			});
		}

		localforage.setItem(cacheId("lastread"),
			{cfi: "", page: 0, total: total});

	}
}

function mark_as_read() {
	if (confirm("Mark book as read?")) {
		const total = 100;
		const lastCfi = window.book.locations.cfiFromPercentage(1);

		if (navigator.onLine) {
			$.post("backend.php", { op: "storelastread", page: total, cfi: lastCfi, id: $.urlParam("id") }, function(data) {
				$(".lastread_input").val(data.page + '%');
			});
		}

		localforage.setItem(cacheId("lastread"),
			{cfi: lastCfi, page: total, total: total});

	}
}

function save_and_close() {
	const location = window.book.rendition.currentLocation();

	const currentCfi = location.start.cfi;
	const currentPage = parseInt(window.book.locations.percentageFromCfi(currentCfi) * 100);
	const totalPages = 100;

	localforage.setItem(cacheId("lastread"),
		{cfi: currentCfi, page: currentPage, total: totalPages});

	if (navigator.onLine) {
		$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
			cfi: currentCfi }, function() {
				window.location = $.urlParam("rt") ? "index.php?mode=" + $.urlParam("rt") : "index.php";
			})
			.fail(function() {
				window.location = "index.php";
			});
	} else {
		window.location = "index.php";
	}
}

function change_theme(elem) {
	const theme = $(elem).val();

	localforage.setItem("epube.theme", theme).then(function() {
		apply_styles();
	});
}

function apply_theme() {
	localforage.getItem("epube.theme").then(function(theme) {
		console.log('theme', theme);

		const base_url = window.location.href.match(/^.*\//)[0];

		if (!theme) theme = 'default';
		const theme_url = base_url + "themes/" + theme + ".css";

		$("#theme_css").attr("href", theme_url);

		$.each(window.book.rendition.getContents(), function(i,c) {
			$(c.document).find("#theme_css").text(_res_data[theme_url])
		});

	});
}

function search() {
	const query = $(".search_input").val();
	const list = $(".search_results");

	list.html("");

	if (query) {

		/* eslint-disable prefer-spread */
		Promise.all(
			book.spine.spineItems.map(
				(item) => item.load(book.load.bind(book))
				.then(item.find.bind(item, query))
				.finally(item.unload.bind(item)))
			)
		.then((results) => Promise.resolve([].concat.apply([], results)))
		.then(function(results) {
			$.each(results, function (i, row) {
				const a = $("<a>")
					.attr('href', '#')
					.html("<b class='pull-right'>" + window.book.locations.locationFromCfi(row.cfi) + "</b>" + row.excerpt)
					.attr('data-cfi', row.cfi)
					.attr('data-id', row.id)
					.click(function() {
							window.book.rendition.display(a.attr('data-cfi'));
					});

				list.append($("<li>").append(a));
			});
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

function open_previous_location(elem) {
	const cfi = $(elem).attr("data-location-cfi");

	if (cfi) {
		window.book.rendition.display(cfi);
	}

	$(elem).fadeOut();
}

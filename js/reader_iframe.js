'use strict';

/* global EpubeApp */

let Reader;
let App;

function enable_swipes() {
	$(window).off("swipeleft swiperight");

	$(window).on("swipeleft", function() {
		Reader.Page.next();
	});

	$(window).on("swiperight", function() {
		Reader.Page.prev();
	});
}

$(document).ready(function() {
	Reader = parent.__get_reader();
	App = parent.__get_app();

	/*$(window).on("doubletap", function(evt) {
		const sel = getSelection().toString().trim();

		if (sel.match(/^$/)) {
			Reader.toggleFullscreen();
		}
	}); */

	$(window).on("click tap", function(evt) {
		if (evt.button == 0) {

			if ($(".modal").is(":visible"))
					return;

			if (typeof EpubeApp != "undefined")
				EpubeApp.toggleActionBar();
			else
				Reader.showUI(true);
		}
	});

	$(window).on("touchstart", function() {
		enable_swipes();
	});

	$(window).on("mousedown", function() {
		$(window).off("swipeleft swiperight");
	});

	$(window).on("wheel", function(evt) {
		if (evt.originalEvent.deltaY > 0) {
			Reader.Page.next();
		} else if (evt.originalEvent.deltaY < 0) {
			Reader.Page.prev();
		}
	});

	let selectionChangeTimeout = null;

	$(document).on("selectionchange", function() {
		if (!App.onLine) return;

		window.clearTimeout(selectionChangeTimeout);

		selectionChangeTimeout = window.setTimeout(function() {
			const sel = getSelection().toString().trim();

			if (sel.match(/^[\w­]+$/)) {
				Reader.lookupWord(sel, function() {
					if (typeof EpubeApp != "undefined")
						EpubeApp.showActionBar(false);

					getSelection().removeAllRanges();
				});
			}
		}, 250);

	});

	enable_swipes();
});


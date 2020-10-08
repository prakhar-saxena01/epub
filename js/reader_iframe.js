'use strict';

/* global EpubeApp */

let Reader;

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

	$(window).on("doubletap", function(/* evt */) {
		const sel = getSelection().toString().trim();

		if (sel.match(/^$/)) {
			Reader.toggleFullscreen();
		}
	});

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

	$(window).on("mouseup touchend", function() {
		if (!navigator.onLine) return;

		const sel = getSelection().toString().trim();

		if (sel.match(/^[\w­]+$/)) {
			Reader.lookupWord(sel, function() {
				if (typeof EpubeApp != "undefined")
					EpubeApp.showActionBar(false);

				getSelection().removeAllRanges();
			});
		}
	});

	enable_swipes();
});


'use strict';

/* global EpubeApp */

function enable_swipes() {
	$(window).off("swipeleft swiperight");

	$(window).on("swipeleft", function() {
		parent.next_page();
	});

	$(window).on("swiperight", function() {
		parent.prev_page();
	});
}

$(document).ready(function() {

	$(window).on("doubletap", function(/* evt */) {
		const sel = getSelection().toString().trim();

		if (sel.match(/^$/)) {
			parent.toggle_fullscreen();
		}
	});

	$(window).on("click tap", function(evt) {
		if (evt.button == 0) {

			if ($(".modal").is(":visible"))
					return;

			if (typeof EpubeApp != "undefined")
				EpubeApp.toggleActionBar();
			else
				parent.show_ui(true);
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
			parent.next_page();
		} else if (evt.originalEvent.deltaY < 0) {
			parent.prev_page();
		}
	});

	enable_swipes();
});


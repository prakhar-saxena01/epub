'use strict';

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
	$(window).on("click tap", function(evt) {
		if (evt.button == 0) {

			if ($(".modal").is(":visible"))
					return;

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


'use strict';

function enable_swipes() {
	$(window).off("swipeleft swiperight");

	$(window).on("swipeleft", function() {
		parent.book.nextPage();
	});

	$(window).on("swiperight", function() {
		parent.book.prevPage();
	});
}

$(document).ready(function() {
	$(window).on("click tap", function() {
		if (parent.$(".header").is(":visible")) {
			parent.show_ui(false);
			parent.request_fullscreen();
		} else {
			parent.show_ui(true);
			parent.disable_fullscreen();
		}
	});

	$(window).on("touchstart", function() {
		enable_swipes();
	});

	$(window).on("mousedown", function() {
		$(window).off("swipeleft swiperight");
	});

	enable_swipes();
});


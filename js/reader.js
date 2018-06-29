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
	console.log('setting taps');

	$(window).on("click tap", function() {
		if (parent.$(".header").is(":visible")) {
			parent.show_ui(false);
		} else {
			parent.show_ui(true);
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


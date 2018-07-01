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

	$(window).on("mouseup", function(evt) {
		if (evt.button == 0) {

			if ($(".modal").is(":visible"))
					return;

			var reader = $("body");
			var margin_side = parseInt(reader.css("padding-left"), 10);

			//console.log(evt, evt.screenX);

			if (evt.screenX >= reader.width() - margin_side) {
				console.log("iframe: RIGHT SIDE");
				parent.next_page();
			} else if (evt.screenX <= margin_side) {
				console.log("iframe: LEFT SIDE");
				parent.prev_page();
			} else {
				if (parent.$(".header").is(":visible")) {
					parent.show_ui(false);
				} else {
					parent.show_ui(true);
				}
			}
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


function setup_swipes() {
	$(window).off("swipeleft swiperight");

	if (parent._has_touch) {
		$(window).on("swiperight", function() {
			parent.prev_page();
		});

		$(window).on("swipeleft", function() {
			parent.next_page();
		});
	}
}

$(document).ready(function() {
	$(window).on("click", function() {
		if (parent.$(".header").is(":visible")) {
			parent.show_ui(false);
			parent.request_fullscreen();
		} else {
			parent.show_ui(true);
			parent.disable_fullscreen();
		}
	});

	$(window).on('touchstart', function touch_detect() {
		$(window).off('touchstart', touch_detect);

		parent._has_touch = true;
		setup_swipes();
	});

	setup_swipes();
});


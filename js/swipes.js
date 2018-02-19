$(window).on("vclick", function() {
	if (parent.$(".header").is(":visible")) {
		parent.show_ui(false);
		parent.request_fullscreen();
	} else {
		parent.show_ui(true);
		parent.disable_fullscreen();
	}
});

$(window).on("swipeleft", function() {
	parent.next_page();
});

$(window).on("swiperight", function() {
	parent.prev_page();
});



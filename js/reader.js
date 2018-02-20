$(window).on("click tap", function() {
	if (parent.$(".header").is(":visible")) {
		parent.show_ui(false);
		parent.request_fullscreen();
	} else {
		parent.show_ui(true);
		parent.disable_fullscreen();
	}
});


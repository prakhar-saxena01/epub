$(window).on("click tap", function() {
	parent.show_ui(true);
	parent.disable_fullscreen();
});

$(window).on("swipeleft", function() {
	parent.next_page();
});

$(window).on("swiperight", function() {
	parent.prev_page();
});



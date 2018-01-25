$(window).on("click", function() {
	parent.toggle_ui();
});

$(window).on("swipeleft", function() {
	parent.next_page();
});

$(window).on("swiperight", function() {
	parent.prev_page();
});



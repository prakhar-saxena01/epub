$(window).on("swipeleft", function() {
	parent.book.nextPage();
});

$(window).on("swiperight", function() {
	parent.book.prevPage();
});


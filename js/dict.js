$(window).on("mouseup touchend", function() {
	if (!navigator.onLine) return;

	var sel = getSelection().toString().trim();

	if (sel.match(/^\w+$/)) {
		parent.dict_lookup(sel, function() {
			getSelection().removeAllRanges();
		});
	}
});


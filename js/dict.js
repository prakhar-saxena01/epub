'use strict';

$(document).ready(function() {
	$(window).on("mouseup touchend", function() {
		if (!navigator.onLine) return;

		const sel = getSelection().toString().trim();

		if (sel.match(/^\w+$/)) {
			parent.Reader.lookupWord(sel, function() {
				getSelection().removeAllRanges();
			});
		}
	});
});

'use strict';

/* global EpubeApp */

$(document).ready(function() {
	const Reader = parent.__get_reader();

	$(window).on("mouseup touchend", function() {
		if (!navigator.onLine) return;

		const sel = getSelection().toString().trim();

		if (sel.match(/^\w+$/)) {
			Reader.lookupWord(sel, function() {
				if (typeof EpubeApp != "undefined")
					EpubeApp.showActionBar(false);

				getSelection().removeAllRanges();
			});
		}
	});
});

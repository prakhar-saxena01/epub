var _swipe_attempts = 0;

function setup_swipes() {

	if (typeof $(window).swipe == "undefined") {
		console.log("swipes not yet available", _swipe_attempts);

		if (_swipe_attempts < 4) {
			_swipe_attempts++;

			window.setTimeout(function() {
				setup_swipes();
			}, 250);
		}

		return;
	}

	console.log("setting up swipe events");

	$(window).swipe({
		swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
			console.log("swipe: ", direction);

			switch (direction) {
				case "right":
					parent.prev_page();
					break;
				case "left":
					parent.next_page();
					break;
			}
		},
		tap:function(event, target) {
			if (parent.$(".header").is(":visible")) {
				parent.show_ui(false);
				parent.request_fullscreen();
			} else {
				parent.show_ui(true);
				parent.disable_fullscreen();
			}
		},
	});
}

setup_swipes();

function offline_cache(elem) {
	try {
		var bookId = elem.getAttribute("data-book-id");

		console.log(bookId);


		return false;

	} catch (e) {
		console.warn(e);
	}
}

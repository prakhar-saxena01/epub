'use strict';

/* global localforage, EpubeApp, App, Cookie, $ */

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_FAMILY = "Georgia";
const DEFAULT_LINE_HEIGHT = 140;
const MIN_LENGTH_TO_JUSTIFY = 32; /* characters */

const LOCATION_DIVISOR = 20;
const PAGE_RESET_PROGRESS = -1;

const Reader = {
	csrf_token: "",
	last_stored_cfi: "",
	prevent_lastread_update: false,
	hyphenate: {},
	init: function() {
		this.csrf_token = Cookie.get('epube_csrf_token');

		console.log('setting prefilter for token', this.csrf_token);

		$.ajaxPrefilter(function(options, originalOptions/*, jqXHR*/) {

			if (originalOptions.type !== 'post' || options.type !== 'post') {
				return;
			}

			const datatype = typeof originalOptions.data;

			if (datatype == 'object')
				options.data = $.param($.extend(originalOptions.data, {"csrf_token": Reader.csrf_token}));
			else if (datatype == 'string')
				options.data = originalOptions.data + "&csrf_token=" + encodeURIComponent(Reader.srf_token);

			console.log('>>>', options);
		});

		$(document).on("keyup", function(e) {
			Reader.hotkeyHandler(e);
		});

		$("#left").on("mouseup", function() {
			Reader.Page.prev();
		});

		$("#right").on("mouseup", function() {
			Reader.Page.next();
		});

		Reader.Loader.init();
	},
	onOfflineModeChanged: function(offline) {
		console.log('onOfflineModeChanged', offline);

		if (!offline && window.book) {
			const book = window.book;

			console.log("we're online, storing lastread");

			const currentCfi = book.rendition.currentLocation().start.cfi;
			const currentPage = parseInt(book.locations.percentageFromCfi(currentCfi) * 100);

			$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
				cfi: currentCfi, timestamp: new Date().getTime() }, function() {
					//
				})
				.fail(function(e) {
					if (e && e.status == 401) {
						window.location = "index.php";
					}
				});
		}
	},
	initSecondStage: function() {

		if (typeof EpubeApp != "undefined") {
			EpubeApp.setPage("PAGE_READER");
		} else {
			$(window).on('online', function() {
				Reader.onOfflineModeChanged(false);
			});

			$(window).on('offline', function() {
				Reader.onOfflineModeChanged(true);
			});
		}

		Reader.applyTheme();

		return localforage.getItem(Reader.cacheId()).then(function(item) {
			if (!item) {
				console.log('requesting bookinfo...')

				return new Promise((resolve, reject) => {
					const bookId = $.urlParam("b");

					$.post("backend.php", {op: "getinfo", id: bookId }).success(function(data) {
						if (data) {
							if (data.has_cover) {
								fetch("backend.php?op=cover&id=" + bookId, {credentials: 'same-origin'}).then(function(resp) {
									if (resp.status == 200) {
										localforage.setItem(Reader.cacheId('cover'), resp.blob());
									}
								});
							}

							return localforage.setItem(Reader.cacheId(), data).then(function() {
								console.log('bookinfo saved');
								resolve();
							})
						}

						reject(new Error("unable to load book info: blank"));

					}).error(function(xhr) {
						$(".loading-message").html("Unable to load book info.<br/><small>" + xhr.status + "</small>");

						reject(new Error("unable to load book info: " + xhr.status));
					});

				});
			} else {
				console.log('bookinfo already stored');
			}
		}).then(function() {

			console.log('trying to load book...');

			localforage.getItem(Reader.cacheId("book")).then(function(item) {

				if (item) {

					console.log("loading from local storage");

					return new Promise(function (resolve, reject) {

						const fileReader = new FileReader();

						fileReader.onload = function() {
							try {
								return book.open(this.result).then(function() {
									resolve();
								})
							} catch (e) {
								$(".loading-message").html("Unable to load book (local).");
								console.log(e);

								reject(new Error("Unable to load book (local):" + e));
							}
						};

						fileReader.readAsArrayBuffer(item);
					});

				} else {

					console.log("loading from network");

					if (App.isOnline()) {
						const book_url = "backend.php?op=download&id=" + $.urlParam("id");

						$(".loading-message").html("Downloading…");

						return fetch(book_url, {credentials: 'same-origin'}).then(function(resp) {

							if (resp.status == 200) {
								return resp.blob().then(function(blob) {

									return new Promise(function(resolve, reject) {

										const fileReader = new FileReader();

										fileReader.onload = function() {
											book.open(this.result).then(function() {

												// let's store this for later
												localforage.setItem(Reader.cacheId('book'), blob).then(function() {
													resolve();
												})

											}).catch((e) => {
												$(".loading-message").html("Unable to open book.<br/><small>" + e + "</small>");

												reject(new Error("Unable to open book: " + e));
											});
										};

										fileReader.onerror = function(e) {
											console.log('filereader error', e);
											$(".loading-message").html("Unable to open book.<br/><small>" + e + "</small>");

											reject(new Error("Unable to open book: " + e));
										};

										fileReader.readAsArrayBuffer(blob);
									});

								}).catch((e) => {
									console.log('blob error', e);
									$(".loading-message").html("Unable to download book.<br/><small>" + e + "</small>");
								});
							} else {
								$(".loading-message").html("Unable to download book: " + resp.status + ".");
							}
						}).catch(function(e) {
							console.warn(e);

							if ($(".loading").is(":visible")) {
								$(".loading-message").html("Unable to load book (remote).<br/><small>" + e + "</small>");
							}
						});

					} else {
						$(".loading-message").html("This book is not available offline.");
					}
				}
			});

			/* global ePub */
			const book = ePub();
			window.book = book;

			const rendition = book.renderTo("reader", {
				width: '100%',
				height: '100%',
				minSpreadWidth: 961
			});

			localforage.getItem("epube.enable-hyphens").then(function(enable_hyphens) {
				if (enable_hyphens) {
					/* global hyphenationPatternsEnUs, hyphenationPatternsRu, createHyphenator */
					Reader.hyphenate.en = createHyphenator(hyphenationPatternsEnUs, { html: true });
					Reader.hyphenate.ru = createHyphenator(hyphenationPatternsRu, { html: true });
				}

				Reader.applyStyles(true);

				/* rendition.hooks.content.register(function() {
					Reader.applyStyles();
				}); */

				rendition.display().then(function() {
					console.log("book displayed");
				});

			});

			rendition.hooks.content.register(function(contents) {

				contents.on("linkClicked", function(href) {
					console.log('linkClicked', href);

					Reader.prevent_lastread_update = true;

					if (href.indexOf("://") == -1) {
						$(".prev_location_btn")
							.attr("data-location-cfi", book.rendition.currentLocation().start.cfi)
							.show();

						window.setTimeout(function() {
							Reader.showUI(true);
						}, 50);
					}

				});

				const base_url = window.location.href.match(/^.*\//)[0];
				const res_names = [ "dist/app-libs.min.js", "dist/reader_iframe.min.js" ];
				const doc = contents.document;

				for (let i = 0; i < res_names.length; i++) {

					// we need to create script element with proper context, that is inside the iframe
					const elem = doc.createElement("script");
					elem.type = 'text/javascript';
					elem.text = Reader.Loader._res_data[base_url + res_names[i]];

					doc.head.appendChild(elem);
				}

				$(contents.document.head)
					.append($("<style type='text/css'>")
						.text(Reader.Loader._res_data[base_url + 'dist/reader_iframe.min.css']));

				if (Reader.Loader._res_data[base_url + 'lib/fonts/pmn-caecilia-55.ttf']) {
					const fonts_css = `
						@font-face {
							font-family: Caecilia;
							src: url(${Reader.Loader._res_data[base_url + 'lib/fonts/pmn-caecilia-55.ttf']});
							font-weight : normal;
						}

						@font-face {
							font-family: Caecilia;
							src: url(${Reader.Loader._res_data[base_url + 'lib/fonts/pmn-caecilia-75.ttf']});
							font-weight : bold;
						}

						@font-face {
							font-family: Caecilia;
							src: url(${Reader.Loader._res_data[base_url + 'lib/fonts/pmn-caecilia-56.ttf']});
							font-style : italic;
						}
						`;

					$(contents.document.head)
						.append($("<style type='text/css'>")
							.text(fonts_css));
				} else {
					$(".font_family option[value='Caecilia']").hide();
				}

				return localforage.getItem("epube.theme").then(function(theme) {
					if (!theme) theme = 'default';

					$(contents.document).find("body")
						.attr("class", typeof EpubeApp != "undefined" ? "is-epube-app" : "")
						.addClass("theme-" + theme);

				});

			});

			$('#settings-modal').on('shown.bs.modal', function() {

				localforage.getItem(Reader.cacheId("lastread")).then((item) => {
					if (item && item.cfi) {
						$(".lastread_input").val(item.page + '%');
					}

					$.post("backend.php", { op: "getlastread", id: $.urlParam("id") }, function(data) {
						$(".lastread_input").val(data.page + '%');
					});

				});

				localforage.getItem("epube.enable-hyphens").then(function(enable) {
					$(".enable_hyphens_checkbox")
						.attr("checked", enable)
						.off("click")
						.on("click", function(evt) {
							localforage.setItem("epube.enable-hyphens", evt.target.checked);

							if (confirm("Toggling hyphens requires page reload. Reload now?")) {
								window.location.reload();
							}
						});
				});

				localforage.getItem("epube.keep-ui-visible").then(function(keep) {
					$(".keep_ui_checkbox")
						.attr("checked", keep)
						.off("click")
						.on("click", function(evt) {
							localforage.setItem("epube.keep-ui-visible", evt.target.checked);
						});
				});

				localforage.getItem("epube.enable-column-hacks").then(function(enable) {
					$(".enable_column_hacks_checkbox")
						.attr("checked", enable)
						.off("click")
						.on("click", function(evt) {
							localforage.setItem("epube.enable-column-hacks", evt.target.checked);
						});
				});

				Promise.all([
					localforage.getItem("epube.cache-timestamp"),
					localforage.getItem("epube.cache-version")
				]).then((res) => {
					const stamp = res[0];
					const version = res[1];

					$(".last-mod-timestamp").html(`${version}
						&mdash; ${parseInt(stamp) ? new Date(stamp*1000).toLocaleString("en-GB") : "Unknown"}
						(${App.isOnline() ? `<span class='text-success'>Online</span>` : `<span class='text-danger'>Offline</span>`})
						`);
				});

				localforage.getItem("epube.fontFamily").then(function(font) {
					if (!font) font = DEFAULT_FONT_FAMILY;

					$(".font_family").val(font);
				});

				localforage.getItem("epube.theme").then(function(theme) {
					$(".theme_name").val(theme);
				});

				localforage.getItem("epube.fontSize").then(function(size) {

					if (!size) size = DEFAULT_FONT_SIZE;

					const zoom = $(".font_size").html("");

					for (let i = 10; i <= 32; i++) {
						const opt = $("<option>").val(i).html(i + " px");
						zoom.append(opt);
					}

					zoom.val(size);

				});

				localforage.getItem("epube.lineHeight").then(function(height) {

					if (!height) height = DEFAULT_LINE_HEIGHT;

					const zoom = $(".line_height").html("");

					for (let i = 100; i <= 220; i += 10) {
						const opt = $("<option>").val(i).html(i + "%");
						zoom.append(opt);
					}

					zoom.val(height);

				});
			});

			$('#dict-modal').on('shown.bs.modal', function() {
				$(".dict_result").scrollTop(0);
			});

			// TODO: make configurable
			$(".dict_search_btn").on("click", function() {
				$("#dict-modal").modal('hide');
				window.open("https://duckduckgo.com/?q=" + $(".dict_query").val());
			});

			$(".wiki_search_btn").on("click", function() {
				$(".dict_result").html("Loading, please wait...");

				$.post("backend.php", {op: "wikisearch", query: $(".dict_query").val()})
					.then((resp) => {
						try {
							console.log('wikisearch resp', resp);

							let tmp = "";

							$.each(resp.query.pages, (i,p) => {
								tmp += p.extract;
							});

							$(".dict_result").html(tmp && tmp != "undefined" ? tmp : "No definition found for " + $(".dict_query").val() + ".");
						} catch (e) {
							console.error(e);
							$(".dict_result").text("Error while processing data: " + e);
						}
					})
					.fail((e) => {
						console.error(e);
						$(".dict_result").text("Error while retrieving data.");
					})
			});

			function toc_loc_msg(href) {
				try {
					const cfiBase = book.spine.get(href).cfiBase;

					const loc = book.locations._locations.find(function(k) {
						return k.indexOf(cfiBase) != -1
					});

					return window.book.locations.locationFromCfi(loc);

				} catch (e) {
					console.warn(e);
				}

				return "";
			}

			function process_toc_sublist(row, list, nest) {

				if (nest == 3) return false;

				if (row.subitems) {

					const sublist = $("<ul class='toc_sublist list-unstyled'>");

					$.each(row.subitems, function(i, row) {

						const a = $("<a>")
							.attr('href', '#')
							.html("<b class='pull-right'>" + toc_loc_msg(row.href) + "</b>" + row.label)
							.attr('data-href', row.href)
							.click(function() {
								book.rendition.display(a.attr('data-href'));
							});

						sublist.append($("<li>").append(a));

						process_toc_sublist(row, sublist, nest + 1);

					});

					list.append(sublist);
				}
			}

			$('#toc-modal').on('shown.bs.modal', function() {

				const toc = book.navigation.toc;

				const list = $(".toc_list");
				list.html("");

				$.each(toc, function(i, row) {

					// if anything fails here the toc entry is likely useless anyway (i.e. no cfi)
					try {
						const a = $("<a>")
							.attr('href', '#')
							.html("<b class='pull-right'>" + toc_loc_msg(row.href) + "</b>" + row.label)
							.attr('data-href', row.href)
							.click(function() {
								book.rendition.display(a.attr('data-href'));
							});

						list.append($("<li>").append(a));

						process_toc_sublist(row, list, 0);

					} catch (e) {
						console.warn(e);
					}
				});

				// well the toc didn't work out, might as well generate one
				if (list.children().length <= 1) {

					list.html("");

					$.each(book.spine.items, function (i, row) {

						const a = $("<a>")
							.attr('href', '#')
							.attr('title', row.url)
							.html("Section " + (i+1))
							.attr('data-href', row.href)
							.click(function() {
								book.rendition.display(a.attr('data-href'));
							});

						list.append($("<li>").append(a));

					});
				}

			});

			/* embedded styles may conflict with our font sizes, etc */
			book.spine.hooks.content.register(function(doc/*, section */) {

				$(doc).find("p")
						.filter((i, e) => (($(e).text().length >= MIN_LENGTH_TO_JUSTIFY) ? e : null))
							.css("text-align", "justify");

				$(doc).find("html")
						.attr("class", "");

				$(doc).find("a, p, span, em, i, strong, b, body, header, section, div, big, small")
						.attr("class", "")
						.css("font-family", "inherit")
						.css("font-size", "inherit")
						.css("color", "")
						.css("border", "none ! important")
						.css("background", "")
						.css("background-color", "");

				// same as above except for allowed font-size
				$(doc).find("h1, h2, h3, h4, h5")
					.attr("class", "")
					.css("font-family", "inherit")
					.css("color", "")
					.css("border", "none ! important")
					.css("background", "")
					.css("background-color", "");

				if (typeof Reader.hyphenate.en != "undefined") {
					$(doc).find('p, div').each((i,p) => {
						p = $(p);

						p.html(Reader.hyphenate.en(p.html()));
						p.html(Reader.hyphenate.ru(p.html()));
					});
				}
			});

			book.ready.then(function() {

				return localforage.getItem(Reader.cacheId()).then((bookinfo) => {

					let title;
					let author;

					if (bookinfo) {
						title = bookinfo.title;
						author = bookinfo.author_sort;
					} else {
						const metadata = book.package.metadata;

						title = metadata.title;
						author = metadata.creator;
					}

					document.title = title + " – " + author + " – The Epube";
					$(".title")
						.text(title)
						.attr("title", title + " – " + author);

					if (typeof EpubeApp != "undefined") {
						EpubeApp.setTitle(title);
						EpubeApp.showActionBar(false);
					}

					return localforage.getItem(Reader.cacheId("locations")).then(function(locations) {

						console.log('stored pagination', locations != null);

						// legacy format is array of objects {cfi: ..., page: ...}
						if (locations && typeof locations[0] == "string") {
							Reader.Page._pagination_stored = 1;
							return book.locations.load(locations);
						} else {
							console.log("requesting pagination...");

							const url = "backend.php?op=getpagination&id=" + encodeURIComponent($.urlParam("id"));

							return fetch(url, {credentials:'same-origin'}).then(function(resp) {

								if (resp.ok) {
									return resp.json().then(function(locations) {
										if (locations && typeof locations[0] == "string") {
											Reader.Page._pagination_stored = 1;
											return book.locations.load(locations);
										} else {
											$(".loading-message").html("Preparing locations…");
											return book.locations.generate(100);
										}
									});
								} else {
									$(".loading-message").html("Preparing locations…");
									return book.locations.generate(100);
								}
							}).catch(function() {
								$(".loading-message").html("Preparing locations…");
								return book.locations.generate(100);
							});
						}
					});

				});

			}).then(function(locations) {

				console.log("locations ready, stored=", Reader.Page._pagination_stored);

				if (locations) {
					if (App.isOnline() && !Reader.Page._pagination_stored) {
						$.post("backend.php", { op: "storepagination", id: $.urlParam("id"),
							payload: JSON.stringify(locations), total: 100});
					}

					// store if needed
					localforage.getItem(Reader.cacheId("locations")).then(function(item) {
						if (!item) localforage.setItem(Reader.cacheId("locations"), locations);
					});

				} else {
					$(".loading-message").html("Could not generate locations.");
					return;
				}

				$(".location").click(function() {
					const current = Math.floor(book.rendition.currentLocation().start.location / LOCATION_DIVISOR);
					const total = Math.floor(book.locations.length() / LOCATION_DIVISOR);

					const page = prompt("Jump to location [1-" + total + "]", current);

					if (page) {
						book.rendition.display(book.locations._locations[page * LOCATION_DIVISOR]);
					}
				});
				Reader.Page.openLastRead();

				window.setTimeout(function() {
					Reader.Page.openLastRead();

					$(".loading").hide();
				}, 250);
			});

			rendition.on("keyup", (e) => {
				Reader.hotkeyHandler(e);
			});

			/*rendition.on('resized', function() {
				console.log('resized');

				$(".loading").show();
				$(".loading-message").html("Opening chapter…");

				window.setTimeout(function() {
					Reader.resizeSideColumns();
					Reader.Page.openLastRead();

					$(".loading").hide();
				}, 250);
			});*/

			rendition.on('rendered', function(/*chapter*/) {
				$(".chapter").html($("<span>").addClass("glyphicon glyphicon-th-list"));

				Reader.applyTheme();

				Reader.resizeSideColumns();

				try {
					const location = book.rendition.currentLocation();

					if (location.start) {
						const cur_href = book.canonical(location.start.href);
						let toc_entry = false;

						$.each(Reader.flattenToc(book), function(i, r) {

							if (book.spine.get(r.href).canonical == cur_href) {
								toc_entry = r;
								return;
							}
						});

						if (toc_entry && toc_entry.label)
							$(".chapter").append("&nbsp;" + toc_entry.label.trim() + " | ");

						Reader.generateTocBar(book, Reader.flattenToc(book));
					}

				} catch (e) {
					console.warn(e);
				}
			});

			rendition.on('relocated', function(location) {

				// locations not generated yet
				if (book.locations.length() == 0)
					return;

				localforage.getItem("epube.enable-column-hacks").then((enable) => {
					if (enable && Reader.Page._moved_next >= 20) {
						console.log('forcing re-render because of column hacks');

						window.book.rendition.onResized($("#reader").width());

						Reader.Page._moved_next = 0;
					}
				});

				const currentCfi = location.start.cfi;
				const currentPct = parseInt(book.locations.percentageFromCfi(currentCfi) * 100);

				$("#cur_page").text(Math.floor(location.start.location / LOCATION_DIVISOR));
				$("#total_pages").text(Math.floor(book.locations.length() / LOCATION_DIVISOR));
				$("#page_pct").text(parseInt(book.locations.percentageFromCfi(currentCfi)*100) + '%');

				Reader.updateTocBarPosition(book, location);

				const displayed = location.start.displayed;

				if (displayed) {
					$("#chapter_cur_page").text(displayed.page);
					$("#chapter_total_pages").text(displayed.total);

					if (displayed.total > 0)
						$("#chapter_pct").text(parseInt(displayed.page / displayed.total * 100) + '%')
				}

				if (Reader.last_stored_cfi != currentCfi && !Reader.prevent_lastread_update) {
					const lastread_timestamp = new Date().getTime();

					console.log("storing lastread", currentPct, currentCfi, lastread_timestamp);

					localforage.setItem(Reader.cacheId("lastread"),
						{cfi: currentCfi, page: currentPct, total: 100, timestamp: lastread_timestamp});

					if (App.isOnline()) {
						console.log("updating remote lastread", currentCfi);
						Reader.last_stored_cfi = currentCfi;

						$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPct,
							cfi: currentCfi, timestamp: lastread_timestamp }).then(() => {
								//
							})
							.fail(function(e) {
								if (e && e.status == 401) {
									window.location = "index.php";
								}
							});
					}
				}

				Reader.prevent_lastread_update = false;
			});
		});
	},
	flattenTocSubItems: function(entry, nest) {
		let rv = [];

		if (nest == 3) return false;

		if (entry.subitems) {
			$.each(entry.subitems, function (i, r) {
				r._nest = nest;

				rv.push(r);
				rv = rv.concat(Reader.flattenTocSubItems(r, nest+1));
			});
		}

		return rv;
	},
	flattenToc: function(book) {
		if (this._flattened_toc) {
			return this._flattened_toc;
		} else {
			let rv = [];

			$.each(book.navigation.toc, function(i, r) {
				r._nest = 0;

				rv.push(r);
				rv = rv.concat(Reader.flattenTocSubItems(r, 1));
			});

			this._flattened_toc = rv;

			return rv;
		}
	},
	generateTocBar: function(book, toc) {

		$(".spacer")
			.html("");

		$.each(toc, function(i, te) {
			try {
				const cfiBase = book.spine.get(te.href).cfiBase;
				const loc = book.locations._locations.find(function(k) {
					return k.indexOf(cfiBase) != -1
				});

				if (loc) {
					const pct = Math.round(book.locations.percentageFromCfi(loc) * 100);

					$(".spacer").append(
						$("<div class='toc-bar-entry'>")
							.attr('data-nest-level', te._nest)
							.css('left', pct + '%')
							.css('_width', (3 - te._nest) + "px")
							.attr("title", te.label)
						)

				}

			} catch (e) {
				console.warn(e);
			}
		});

		$(".spacer").append($("<div class='toc-bar-entry current-position'>"));

		Reader.updateTocBarPosition(book, book.rendition.currentLocation())

	},
	updateTocBarPosition: function(book, location) {
		const cur_pct = Math.round(location.start.location / book.locations.length() * 100);

		$(".toc-bar-entry.current-position")
				.css('left', cur_pct + '%');
	},
	applyStyles: function(default_only) {
		Promise.all([
			localforage.getItem("epube.fontSize"),
			localforage.getItem("epube.fontFamily"),
			localforage.getItem("epube.lineHeight"),
			localforage.getItem("epube.theme")
		]).then(function(res) {
			const fontSize = res[0] ? res[0] + "px" : DEFAULT_FONT_SIZE + "px";
			const fontFamily = res[1] ? res[1] : DEFAULT_FONT_FAMILY;
			const lineHeight = res[2] ? res[2] + "%" : DEFAULT_LINE_HEIGHT + "%";
			//const themeName = res[3] ? res[3] : false;

			console.log('style', fontFamily, fontSize, lineHeight);

			console.log('applying default theme...');

			window.book.rendition.themes.default({
				html: {
					'font-size': fontSize,
					'font-family': "'" + fontFamily + "'",
					'line-height': lineHeight,
					'text-align': 'justify',
					'text-indent': '1em'
				}
			});

			if (!default_only) {
				console.log('applying rendition themes...');

				$.each(window.book.rendition.getContents(), function(i, c) {
					c.css("font-size", fontSize);
					c.css("font-family", "'" + fontFamily + "'");
					c.css("line-height", lineHeight);
					c.css("text-align", 'justify');
				});
			}

			Reader.applyTheme();
		});

	},
	applyTheme: function() {
		localforage.getItem("epube.theme").then(function(theme) {
			if (!theme) theme = 'default';

			console.log('called for theme', theme);

			if (theme == "default" && typeof EpubeApp != "undefined")
				if (EpubeApp.isNightMode())
					theme = "night";

			console.log('setting main UI theme', theme);

			$("body")
				.attr("class", typeof EpubeApp != "undefined" ? "is-epube-app" : "")
				.addClass("epube-reader theme-" + theme)
				.attr("data-is-loading", "false");

			if (typeof EpubeApp != "undefined") {

				window.setTimeout(function() {
					const bg_color = window.getComputedStyle(document.querySelector("body"), null)
						.getPropertyValue("background-color");

					const match = bg_color.match(/rgb\((\d{1,}), (\d{1,}), (\d{1,})\)/);

					if (match) {
						console.log("sending bgcolor", match);

						EpubeApp.setStatusBarColor(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
					}
				}, 250);
			}

			if (window.book)
				$.each(window.book.rendition.getContents(), function(i, c) {
					console.log('applying rendition theme', theme, 'to', c, c.document);

					$(c.document).find("body")
						.attr("class", typeof EpubeApp != "undefined" ? "is-epube-app" : "")
						.addClass("theme-" + theme);
				});

		});
	},
	hotkeyHandler: function(e) {
		try {
			//console.log('K3:' + e.which, e);

			if ($(".modal").is(":visible"))
				return;

			// right or space or pagedown
			if (e.which == 39 || e.which == 32 || e.which == 34) {
				e.preventDefault();
				Reader.Page.next();
			}

			// left or pageup
			if (e.which == 37 || e.which == 33) {
				e.preventDefault();
				Reader.Page.prev();
			}

			// esc
			if (e.which == 27) {
				e.preventDefault();
				Reader.showUI(true);
			}
		} catch (e) {
			console.warn(e);
		}
	},
	resizeSideColumns: function() {
		let width = $("#reader").position().left;
		const iframe = $("#reader iframe")[0];

		if (iframe && iframe.contentWindow.$)
			width += parseInt(iframe.contentWindow.$("body").css("padding-left"));

		//console.log("resize columns, width=", width);

		$("#left, #right").width(width);
	},
	markAsRead: function() {
		if (confirm("Mark book as read?")) {
			const total = 100;
			const lastCfi = window.book.locations.cfiFromPercentage(1);
			const lastread_timestamp = new Date().getTime();

			if (App.isOnline()) {
				$.post("backend.php", { op: "storelastread", page: total, cfi: lastCfi, id: $.urlParam("id"), timestamp: lastread_timestamp }, function(data) {
					$(".lastread_input").val(data.page + '%');
				});
			}

			localforage.setItem(Reader.cacheId("lastread"),
				{cfi: lastCfi, page: total, total: total, timestamp: lastread_timestamp});

		}
	},
	close: function() {
		const location = window.book.rendition.currentLocation();

		const currentCfi = location.start.cfi;
		const currentPage = parseInt(window.book.locations.percentageFromCfi(currentCfi) * 100);
		const totalPages = 100;
		const lastread_timestamp = new Date().getTime();

		localforage.setItem(Reader.cacheId("lastread"),
			{cfi: currentCfi, page: currentPage, total: totalPages, timestamp: lastread_timestamp});

		if (App.isOnline()) {
			$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
				cfi: currentCfi, timestamp: lastread_timestamp }, function() {
				window.location = $.urlParam("rt") ? "index.php?mode=" + $.urlParam("rt") : "index.php";
			})
				.fail(function() {
					window.location = "index.php";
				});
		} else {
			window.location = "index.php";
		}
	},
	cacheId: function(suffix) {
		return "epube-book." + $.urlParam("b") + (suffix ? "." + suffix : "");
	},
	toggleFullscreen: function() {
		if (typeof EpubeApp != "undefined") {
			/* noop, handled elsewhere */
		} else {
			const element = document.documentElement;
			const isFullscreen = document.webkitIsFullScreen || document.mozFullScreen || false;

			element.requestFullScreen = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen ||
				function () { return false; };

			document.cancelFullScreen = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen ||
				function () { return false; };

			isFullscreen ? document.cancelFullScreen() : element.requestFullScreen();
		}
	},
	showUI: function(show) {
		if (show)
			$(".header,.footer").fadeIn();
		else
			$(".header,.footer").fadeOut();
	},
	toggleUI: function() {
		if ($(".header").is(":visible"))
			$(".header,.footer").fadeOut();
		else
			$(".header,.footer").fadeIn();
	},
	lookupWord: function(word, callback) {
		word = word.replace(/­/g, "");

		$(".dict_result").html('Loading, please wait...');

		$("#dict-modal").modal('show');

		$.post("backend.php", {op: 'define', word: word}, function (data) {
			if (data) {

				$(".dict_result").html(data.result.join("<br/>"));
				$(".dict_query").val(word);

				if (callback) callback();
			}
		}).fail(function(res) {
			console.warn(res);
			$(".dict_result").html('Network error while looking up word: ' + res.statusText);
		});
	},
	search: function() {
		const query = $(".search_input").val();
		const list = $(".search_results");

		list.html("");

		if (query) {

			/* eslint-disable prefer-spread */
			Promise.all(
				window.book.spine.spineItems.map(
					(item) => item.load(window.book.load.bind(window.book))
						.then(item.find.bind(item, query))
						.finally(item.unload.bind(item)))
			)
				.then((results) => Promise.resolve([].concat.apply([], results)))
				.then(function(results) {
					$.each(results, function (i, row) {
						const a = $("<a>")
							.attr('href', '#')
							.html("<b class='pull-right'>" + window.book.locations.locationFromCfi(row.cfi) + "</b>" + row.excerpt)
							.attr('data-cfi', row.cfi)
							.attr('data-id', row.id)
							.click(function() {
								window.book.rendition.display(a.attr('data-cfi'));
							});

						list.append($("<li>").append(a));
					});
				});
		}
	},
	Loader: {
		_res_data: [],
		init: function() {
			// we need to preload resources for reader iframe because it can't utilize our
			// service worker because while offline it is created outside our base server context
			const res_names = [ "dist/app-libs.min.js",
				"dist/reader_iframe.min.js", "dist/reader_iframe.min.css",
				"lib/fonts/pmn-caecilia-55.ttf",
				"lib/fonts/pmn-caecilia-56.ttf",
				"lib/fonts/pmn-caecilia-75.ttf" ];

			const promises = [];
			let load_failed = false;

			res_names.forEach((res_name) => {
				console.log('loading resource', res_name);
				const promise = fetch(res_name, {credentials: 'same-origin'}).then(function(resp) {
					if (resp.status == 200) {
						if (resp.url.indexOf('.ttf') != -1) {
							return resp.blob().then((blob) => {

								const url = new URL(resp.url);
								url.searchParams.delete("ts");

								Reader.Loader._res_data[url.toString()] = URL.createObjectURL(blob);
							});
						} else {
							return resp.text().then(function(data) {
								const url = new URL(resp.url);
								url.searchParams.delete("ts");

								Reader.Loader._res_data[url.toString()] = data;
							})
						}
					} else {
						console.warn('loader failed for resource', res_name, resp);

						// fonts are optional
						if (res_name.indexOf('.ttf') == -1) {
							$(".loading-message").html(`Unable to load resource.<br/><small>${res_name}</small>`);
							load_failed = true;
							return;
						}
					}
				});

				promises.push(promise);
			});

			Promise.allSettled(promises).then(() => {
				console.log('resource load complete');

				if (!load_failed)
					Reader.initSecondStage();
				else
					Reader.applyTheme(); // fade in, etc
			});

		},
	},
	Page: {
		_pagination_stored: 0,
		_moved_next: 0,
		next: function() {
			window.book.rendition.next();

			Reader.Page._moved_next += 1;

			if (typeof EpubeApp != "undefined")
				EpubeApp.showActionBar(false);
			else
				localforage.getItem("epube.keep-ui-visible").then(function(keep) {
					if (!keep) Reader.showUI(false);
				});
		},
		prev: function() {
			window.book.rendition.prev();

			if (typeof EpubeApp != "undefined")
				EpubeApp.showActionBar(false);
			else
				localforage.getItem("epube.keep-ui-visible").then(function(keep) {
					if (!keep) Reader.showUI(false);
				});
		},
		openPrevious: function(elem) {
			const cfi = $(elem).attr("data-location-cfi");

			if (cfi) {
				window.book.rendition.display(cfi);
			}

			$(elem).fadeOut();
		},
		clearLastRead: function() {
			if (confirm("Clear stored last read location?")) {
				const total = window.book.locations.length();
				const lastread_timestamp = new Date().getTime();

				if (App.isOnline()) {
					$.post("backend.php", { op: "storelastread", page: PAGE_RESET_PROGRESS, cfi: "", id: $.urlParam("id"), timestamp: lastread_timestamp }, function(data) {
						$(".lastread_input").val(data.page + '%');
					});
				}

				localforage.setItem(Reader.cacheId("lastread"),
					{cfi: "", page: 0, total: total, timestamp: lastread_timestamp});

				window.setTimeout(function() {
					window.book.rendition.display(window.book.locations.cfiFromPercentage(0));
				}, 250);
			}
		},
		openLastRead: function(local_only) {
			localforage.getItem(Reader.cacheId("lastread")).then(function(lr_local) {
				console.log('lr local', lr_local);

				lr_local = lr_local || {};

				// CFI missing or w/e
				try {

					// this is ridiculous tbh
					if (lr_local.cfi) window.book.rendition.display(lr_local.cfi).then(() => {
						$(".loading").hide();

						if (lr_local.cfi)
							window.book.rendition.display(lr_local.cfi);
					});

				} catch (e) {
					console.warn(e);
				}

				if (App.isOnline() && !local_only) {
					$.post("backend.php", { op: "getlastread", id: $.urlParam("id") }, function(lr_remote) {
						console.log('lr remote', lr_remote);

						if (App.isOnline() && lr_remote) {
							try {
								if (lr_remote.cfi && lr_local.cfi != lr_remote.cfi && lr_remote.timestamp > lr_local.timestamp)
									console.log('using remote lastread (timestamp is newer)');

									localforage.setItem(Reader.cacheId("lastread"),
										{cfi: lr_remote.cfi, page: lr_remote.page, total: lr_remote.total, timestamp: lr_remote.timestamp});

									window.book.rendition.display(lr_remote.cfi).then(() => {
										window.book.rendition.display(lr_remote.cfi);
									});

							} catch (e) {
								console.warn(e);
							}

						}
					}).fail(function(e) {
							if (e && e.status == 401) {
								window.location = "index.php";
							}
					});
				}
			});
		},
	},
	Settings: {
		onThemeChanged: function(elem) {
			const theme = $(elem).val();

			localforage.setItem("epube.theme", theme).then(function() {
				Reader.applyTheme();
			});
		},
		onLineHeightChanged: function(elem) {
			const height = $(elem).val();

			localforage.setItem("epube.lineHeight", height).then(function() {
				Reader.applyStyles();
			});
		},
		onTextSizeChanged: function(elem) {
			const size = $(elem).val();

			localforage.setItem("epube.fontSize", size).then(function() {
				Reader.applyStyles();
			});
		},
		onFontChanged: function(elem) {
			const font = $(elem).val();

			localforage.setItem("epube.fontFamily", font).then(function() {
				Reader.applyStyles();
			});
		}
	}
};

/* exported __get_reader */
function __get_reader() {
	return Reader;
}

/* exported __get_app */
function __get_app() {
	return App;
}

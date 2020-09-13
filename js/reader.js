'use strict';

/* global localforage, EpubeApp */

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_FONT_FAMILY = "Georgia";
const DEFAULT_LINE_HEIGHT = 140;
const MIN_LENGTH_TO_JUSTIFY = 32; /* characters */

const Reader = {
	init: function() {
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
	initSecondStage: function() {

		if (typeof EpubeApp != "undefined") {
			EpubeApp.setPage("PAGE_READER");
		}

		Reader.applyTheme();

		/* global Cookie */

		if (Cookie.get("is-epube-app") == "true") {
			$("body").addClass("is-epube-app");
		}

		$(window).on('online', function() {
			console.log("we're online, storing lastread");

			const currentCfi = book.rendition.currentLocation().start.cfi;
			const currentPage = parseInt(book.locations.percentageFromCfi(currentCfi) * 100);

			$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
				cfi: currentCfi }, function(data) {

				if (data.cfi) {
					Reader.Page._last_position_sync = new Date().getTime()/1000;
				}
			})
				.fail(function(e) {
					if (e && e.status == 401) {
						window.location = "index.php";
					}
				});
		});

		localforage.getItem(Reader.cacheId("book")).then(function(item) {

			// ios doesn't work with FileReader for whatever reason
			if (/*!_is_ios &&*/ item) {

				console.log("loading from local storage");

				const fileReader = new FileReader();

				fileReader.onload = function() {
					try {
						book.open(this.result);
					} catch (e) {
						$(".loading_message").html("Unable to load book (local).");
						console.log(e);
					}
				};

				fileReader.readAsArrayBuffer(item);

			} else {

				console.log("loading from network");

				if (navigator.onLine) {
					const book_url = "backend.php?op=download&id=" + $.urlParam("id");

					$(".loading_message").html("Downloading...");

					fetch(book_url, {credentials: 'same-origin'}).then(function(resp) {

						if (resp.status == 200) {
							const bookId = $.urlParam("b");

							resp.blob().then(function(blob) {

								// if there's no base information cached yet, let's do that too
								localforage.getItem(Reader.cacheId()).then(function(info) {
									if (!info) {
										$.post("backend.php", {op: "getinfo", id: bookId }, function(data) {
											if (data) {
												localforage.setItem(Reader.cacheId(), data);

												if (data.has_cover) {
													fetch("backend.php?op=cover&id=" + bookId, {credentials: 'same-origin'}).then(function(resp) {
														if (resp.status == 200) {
															localforage.setItem(Reader.cacheId('cover'), resp.blob());
														}
													});
												}
											}
										});
									}
								});

								const fileReader = new FileReader();

								fileReader.onload = function() {
									book.open(this.result).then(() => {

										// let's store this for later
										localforage.setItem(Reader.cacheId('book'), blob);

									}).catch((e) => {
										$(".loading_message").html("Unable to open book.<br/><small>" + e + "</small>");
									});
								};

								fileReader.onerror = function(e) {
									console.log('filereader error', e);
									$(".loading_message").html("Unable to open book.<br/><small>" + e + "</small>");
								};

								fileReader.readAsArrayBuffer(blob);

							}).catch((e) => {
								console.log('blob error', e);
								$(".loading_message").html("Unable to download book.<br/><small>" + e + "</small>");
							});
						} else {
							$(".loading_message").html("Unable to download book: " + resp.status + ".");
						}
					}).catch(function(e) {
						console.warn(e);

						if ($(".loading").is(":visible")) {
							$(".loading_message").html("Unable to load book (remote).<br/><small>" + e + "</small>");
						}
					});

				} else {
					$(".loading_message").html("This book is not available offline.");
				}
			}
		});

		const book = ePub();
		window.book = book;

		const rendition = book.renderTo("reader", {
			width: '100%',
			height: '100%',
			minSpreadWidth: 961
		});

		Reader.applyStyles(true);

		/* rendition.hooks.content.register(function() {
			Reader.applyStyles();
		}); */

		rendition.display().then(function() {
			console.log("book displayed");
		});

		rendition.hooks.content.register(function(contents) {

			contents.on("linkClicked", function(href) {
				console.log('linkClicked', href);

				if (href.indexOf("://") == -1) {
					$(".prev_location_btn")
						.attr("data-location-cfi", book.rendition.currentLocation().start.cfi)
						.show();

					window.setTimeout(function() {
						show_ui(true);
					}, 50);
				}

			});

			const base_url = window.location.href.match(/^.*\//)[0];
			const res_names = [ "lib/bootstrap/v3/js/jquery.js", "lib/jquery.mobile-events.min.js",
				"js/reader_iframe.js", "js/dict.js" ];
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
					.text(Reader.Loader._res_data[base_url + 'css/reader.css']));

			return localforage.getItem("epube.theme").then(function(theme) {
				if (!theme) theme = 'default';

				const theme_url = base_url + 'themes/' + theme + '.css';

				$(contents.document.head)
					.append($("<style type='text/css' id='theme_css'>")
						.text(Reader.Loader._res_data[theme_url]));
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

			localforage.getItem("epube.keep-ui-visible").then(function(keep) {
				$(".keep_ui_checkbox")
					.attr("checked", keep)
					.off("click")
					.on("click", function(evt) {
						localforage.setItem("epube.keep-ui-visible", evt.target.checked);
					});
			});

			localforage.getItem("epube.cache-timestamp").then(function(stamp) {
				if (parseInt(stamp))
					$(".last-mod-timestamp").text("V: " + new Date(stamp*1000).toLocaleString("en-GB"))
				else
					$(".last-mod-timestamp").text("");
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

		book.ready.then(function() {

			const meta = book.package.metadata;

			document.title = meta.title + " – " + meta.creator + " – The Epube";
			$(".title").text(meta.title);

			if (typeof EpubeApp != "undefined") {
				EpubeApp.setTitle(meta.title);
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
									$(".loading_message").html("Paginating...");
									return book.locations.generate(1600);
								}
							});
						} else {
							$(".loading_message").html("Paginating...");
							return book.locations.generate(1600);
						}
					}).catch(function() {
						$(".loading_message").html("Paginating...");
						return book.locations.generate(1600);
					});
				}

			});

		}).then(function(locations) {

			console.log("locations ready, stored=", Reader.Page._pagination_stored);

			if (locations) {
				if (navigator.onLine && !Reader.Page._pagination_stored) {
					$.post("backend.php", { op: "storepagination", id: $.urlParam("id"),
						payload: JSON.stringify(locations), total: 100});
				}

				// store if needed
				localforage.getItem(Reader.cacheId("locations")).then(function(item) {
					if (!item) localforage.setItem(Reader.cacheId("locations"), locations);
				});

			} else {
				$(".loading_message").html("Pagination failed.");
				return;
			}

			$(".location").click(function() {
				const current = book.rendition.currentLocation().start.location;
				const total = book.locations.length();

				const page = prompt("Jump to location [1-" + total + "]", current);

				if (page) {
					book.rendition.display(book.locations._locations[page]);
				}
			});

			Reader.Page.openLastRead();

			window.setTimeout(function() {
				Reader.Page.openLastRead();

				$(".loading").hide();
			}, 250);
		});

		rendition.on("keyup", (e) => { Reader.hotkeyHandler(e) });

		rendition.on('resized', function() {
			console.log('resized');

			$(".loading").show();
			$(".loading_message").html("Opening chapter...");

			window.setTimeout(function() {
				Reader.resizeSideColumns();
				Reader.Page.openLastRead();

				$(".loading").hide();
			}, 250);
		});

		rendition.on('rendered', function(/*chapter*/) {
			$(".chapter").html($("<span>").addClass("glyphicon glyphicon-th-list"));

			Reader.applyTheme();

			Reader.resizeSideColumns();

			try {
				const location = book.rendition.currentLocation();

				if (location.start) {
					const cur_href = book.canonical(location.start.href);
					let toc_entry = false;

					/* eslint-disable no-inner-declarations */
					function iterate_sublist(row, nest) {
						if (nest == 2) return false;

						if (row.subitems) {
							$.each(row.subitems, function (i, r) {

								if (book.spine.get(r.href).canonical == cur_href) {
									toc_entry = r;
									return true;
								}

								if (iterate_sublist(r, nest + 0))
									return true;
							});
						}

						return false;
					}
					/* eslint-enable no-inne-declarations */

					$.each(book.navigation.toc, function(i, a) {
						if (book.spine.get(a.href).canonical == cur_href) {
							toc_entry = a;
							return;
						}

						if (iterate_sublist(a, 0)) return;

					});

					if (toc_entry && toc_entry.label.trim())
						$(".chapter").append("&nbsp;" + toc_entry.label);
				}

			} catch (e) {
				console.warn(e);
			}
		});

		rendition.on('relocated', function(location) {

			// locations not generated yet
			if (book.locations.length() == 0)
				return;

			const currentCfi = location.start.cfi;
			const currentPage = parseInt(book.locations.percentageFromCfi(currentCfi) * 100);
			const pct = book.locations.percentageFromCfi(currentCfi);

			$("#cur_page").html(location.start.location);
			$("#total_pages").html(book.locations.length());

			$("#page_pct").html(parseInt(pct*100) + '%');

			if (Reader.Page._store_position && new Date().getTime()/1000 - Reader.Page._last_position_sync > 15) {
				console.log("storing lastread", currentPage, currentCfi);

				if (navigator.onLine) {

					$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
						cfi: currentCfi }, function(data) {

						if (data.cfi) {
							Reader.Page._last_position_sync = new Date().getTime()/1000;
						}

					})
						.fail(function(e) {
							if (e && e.status == 401) {
								window.location = "index.php";
							}
						});

					Reader.Page._store_position = 0;
				} else {
					Reader.Page._last_position_sync = 0;
				}

				localforage.setItem(Reader.cacheId("lastread"),
					{cfi: currentCfi, page: currentPage, total: 100});

			}
		});
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
					'text-align': 'justify'
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
			const base_url = window.location.href.match(/^.*\//)[0];

			if (!theme) theme = 'default';

			console.log('called for theme', theme);

			if (theme == "default" && typeof EpubeApp != "undefined")
				if (EpubeApp.isNightMode())
					theme = "night";

			console.log('setting main UI theme', theme);

			const theme_url = base_url + "themes/" + theme + ".css";
			const theme_data = Reader.Loader._res_data[theme_url];

			if (!theme_data) {
				console.error('theme data not found for', theme, '- check resource loader configuration');
				return;
			}

			$("#theme_css").attr("href", theme_url);

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

			/* apply to existing reader */
			//$($("#reader iframe")[0].contentDocument).find("#theme_css").text(Reader.Loader._res_data[theme_url])

			$.each(window.book.rendition.getContents(), function(i, c) {
				console.log('applying rendition theme', theme, 'to', c, c.document);

				$(c.document).find("#theme_css").text(Reader.Loader._res_data[theme_url]);

				$(c.document).find("p")
					.filter((i, e) => { if ($(e).text().length >= MIN_LENGTH_TO_JUSTIFY) return e; })
						.css("text-align", "justify");

				/* embedded styles may conflict with our font sizes, etc */
				$(c.document).find("p, span, em, strong, body")
						.attr("class", "")
						.css("color", "")
						.css("background", "")
						.css("background-color", "")

				$(c.document).find("p")
						.css("text-indent", "1em");

			});

		});
	},
	hotkeyHandler: function(e) {
		try {
			//console.log('K3:' + e.which, e);

			if ($(".modal").is(":visible"))
				return;

			// right or space
			if (e.which == 39 || e.which == 32) {
				e.preventDefault();
				Reader.Page.next();
			}

			// left
			if (e.which == 37) {
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

			if (navigator.onLine) {
				$.post("backend.php", { op: "storelastread", page: total, cfi: lastCfi, id: $.urlParam("id") }, function(data) {
					$(".lastread_input").val(data.page + '%');
				});
			}

			localforage.setItem(Reader.cacheId("lastread"),
				{cfi: lastCfi, page: total, total: total});

		}
	},
	close: function() {
		const location = window.book.rendition.currentLocation();

		const currentCfi = location.start.cfi;
		const currentPage = parseInt(window.book.locations.percentageFromCfi(currentCfi) * 100);
		const totalPages = 100;

		localforage.setItem(Reader.cacheId("lastread"),
			{cfi: currentCfi, page: currentPage, total: totalPages});

		if (navigator.onLine) {
			$.post("backend.php", { op: "storelastread", id: $.urlParam("id"), page: currentPage,
				cfi: currentCfi }, function() {
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
		$.post("backend.php", {op: 'define', word: word}, function (data) {
			if (data) {

				$(".dict_result").html(data.result.join("<br/>"));
				$(".dict_query").val(word);
				$("#dict-modal").modal('show');

				if (callback) callback();
			}
		});
	},
	search: function() {
		const query = $(".search_input").val();
		const list = $(".search_results");

		list.html("");

		if (query) {

			/* eslint-disable prefer-spread */
			Promise.all(
				book.spine.spineItems.map(
					(item) => item.load(book.load.bind(book))
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
			const res_names = [ "lib/bootstrap/v3/js/jquery.js", "lib/jquery.mobile-events.min.js",
				"css/transitions.css", "js/reader_iframe.js", "css/reader.css", "js/dict.js",
				"themes/default.css", "themes/light.css", "themes/mocca.css", "themes/night.css",
				"themes/plan9.css", "themes/gray.css", "themes/sepia.css" ];

			for (let i = 0; i < res_names.length; i++) {
				fetch(res_names[i], {credentials: 'same-origin'}).then(function(resp) {
					if (resp.status == 200) {
						resp.text().then(function(data) {
							const url = new URL(resp.url);
							url.searchParams.delete("ts");

							Reader.Loader._res_data[url.toString()] = data;
						})
					} else {
						console.warn('loader failed for resource', res_names[i], resp);
					}
				});
			}
			Reader.Loader.checkProgress(res_names, Reader.Loader._res_data, 0);
		},
		checkProgress: function(res_names, res_data, attempt) {
			console.log("check_resource_load", attempt, res_names.length, Object.keys(res_data).length, Reader, Reader.Loader);

			if (attempt == 5) {
				$(".loading_message").html("Unable to load resources.");
				return;
			}

			if (res_names.length != Object.keys(res_data).length) {
				window.setTimeout(function() {
					Reader.Loader.checkProgress(res_names, res_data, attempt+1);
				}, 250);
			} else {
				Reader.initSecondStage();
			}
		},
	},
	Page: {
		_store_position: 0,
		_last_position_sync: 0,
		_pagination_stored: 0,
		next: function() {
			Reader.Page._store_position = 1;

			window.book.rendition.next();

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

				if (navigator.onLine) {
					$.post("backend.php", { op: "storelastread", page: -1, cfi: "", id: $.urlParam("id") }, function(data) {
						$(".lastread_input").val(data.page + '%');
					});
				}

				localforage.setItem(Reader.cacheId("lastread"),
					{cfi: "", page: 0, total: total});

			}
		},
		openLastRead: function(local_only) {
			localforage.getItem(Reader.cacheId("lastread")).then(function(item) {
				console.log('lr local', item);

				item = item || {};

				// CFI missing or w/e
				try {

					// this is ridiculous tbh
					if (item.cfi) book.rendition.display(item.cfi).then(() => {
						$(".loading").hide();

						book.rendition.display(item.cfi);
					});

				} catch (e) {
					console.warn(e);
				}

				if (navigator.onLine && !local_only) {
					$.post("backend.php", { op: "getlastread", id: $.urlParam("id") }, function(data) {
						console.log('lr remote', data);

						if (navigator.onLine && data) {
							try {
								if (item.cfi != data.cfi && (!item.page || data.page >= item.page))
									console.log('using remote lastread...');

									localforage.setItem(Reader.cacheId("lastread"),
										{cfi: data.cfi, page: data.page, total: data.total});

									book.rendition.display(data.cfi).then(() => {
										book.rendition.display(data.cfi);
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

function __get_reader() {
	return Reader;
}

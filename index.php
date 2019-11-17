<?php
	if (!file_exists("config.php")) {
		die("Please copy config.php-dist to config.php and edit it.");
	}

	if (!is_writable("sessions")) {
		die("sessions/ directory is not writable.");
	}

	if (!isset($_COOKIE['epube_sid'])) {
		header("Location: login.php");
		exit;
	}

	require_once "config.php";
	require_once "sessions.php";
	require_once "db.php";

	@$owner = $_SESSION["owner"];

	if (!$owner) {
		header("Location: login.php");
		exit;
	}

	if (basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)) != 'index.php') {
		header('Location: index.php');
		exit;
	}

	if (!$owner) {
		header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
		echo "Unauthorized";
		die;
	}

	if (!is_writable(SCRATCH_DB)) {
		die(SCRATCH_DB . " is not writable");
	}

	if (!is_writable(dirname(SCRATCH_DB))) {
		die(dirname(SCRATCH_DB) . " directory is not writable");
	}

	@$mode = htmlspecialchars($_REQUEST["mode"]);

	$ldb = Db::get();
?>
<!DOCTYPE html>
<html>
<head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="lib/bootstrap/v3/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="lib/bootstrap/v3/css/bootstrap-theme.min.css" rel="stylesheet" media="screen">
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<script src="lib/bootstrap/v3/js/jquery.js"></script>
	<script src="lib/bootstrap/v3/js/bootstrap.min.js"></script>
	<script src="lib/promise.js"></script>
	<script src="lib/fetch.js"></script>
	<script src="lib/holder.min.js"></script>
	<script src="lib/localforage.min.js"></script>
	<title>The Epube</title>
	<link type="text/css" rel="stylesheet" media="screen" href="css/index.css?<?php echo time() ?>" />
	<link rel="shortcut icon" type="image/png" href="img/favicon.png" />
	<link rel="manifest" href="manifest.json">
	<meta name="mobile-web-app-capable" content="yes">
	<script src="js/index.js?<?php echo time() ?>"></script>
	<script src="js/common.js?<?php echo time() ?>"></script>
</head>
<body>

<?php
	@$query = $_REQUEST["query"];
?>

<div class="navbar navbar-default navbar-static-top">
<div class="container">
	<div class="navbar-header">
		<span class="navbar-brand"><a href="?">The Epube</a></span>

		<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#nav-collapse" aria-expanded="false">
			<span class="sr-only">Toggle navigation</span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
		</button>

	</div>

	<?php
		$fav_active = $mode == "favorites" ? "active" : "";
		$index_active = $mode != "favorites" ? "active" : "";
	?>

	<div class="collapse navbar-collapse" id="nav-collapse">

		<ul class="nav navbar-nav">
			<li class="<?php echo $index_active ?>"><a href="index.php">All</a></li>
			<li class="<?php echo $fav_active ?>"><a href="index.php?mode=favorites">Favorites</a></li>
			<li><a href="offline.html">Local</a></li>
		</ul>

		<form class="navbar-form navbar-right">
			<div class="input-group">
				<input type="text" name="query" class="form-control" placeholder="Search for..."
					value="<?php echo htmlspecialchars($query) ?>">
				<input type="hidden" name="mode" value="<?php echo $mode ?>">
				<span class="input-group-btn">
					<button type="submit" class="btn btn-default">Go</button>
				</span>
			</div>
		</form>

		<ul class="nav navbar-nav navbar-right">
			<li><a href="#" title="Refresh script cache" onclick="return cache_refresh(true)">
				<span class="glyphicon glyphicon-refresh"></span> <span class='hidden-sm hidden-md hidden-lg'>Refresh script cache</span></a></li>
			</li>
			<?php if ($mode !== "favorites") { ?>
				<li><a href="logout.php" title="Log out">
					<span class="glyphicon glyphicon-log-out"></span> <span class='hidden-sm hidden-md hidden-lg'>Log out</span>
				</a></li>
			<?php } ?>
			<?php if ($mode == "favorites") { ?>
				<li><a href="#" onclick="offline_get_all()" title="Download all">
					<span class="glyphicon glyphicon-download-alt text-primary"></span> <span class='hidden-sm hidden-md hidden-lg'>Download all</span>
				</a></li>
			<?php } ?>
		</ul>
	</div>

</div>
</div>

<script type="text/javascript">
	var index_mode = "<?php echo $mode ?>";

	$(document).ready(function() {
		let refreshed_files = 0;

		if ('serviceWorker' in navigator) {
 			 navigator.serviceWorker
           .register('worker.js?<?php echo time() ?>')
           .then(function() {
					console.log("service worker registered");
			  });

			 navigator.serviceWorker.addEventListener('message', function(event) {

				if (event.data == 'refresh-started') {
					console.log('cache refresh started');
					refreshed_files = 0;

					$(".dl-progress")
						.fadeIn()
						.text("Loading, please wait...");
				}

				if (event.data && event.data.indexOf("refreshed:") == 0) {
					++refreshed_files;

					$(".dl-progress")
						.fadeIn()
						.text("Updated " + refreshed_files + " files...");
				}

				if (event.data == 'client-reload') {
					window.location.reload()
				}

			 });
		} else {
			$(".container-main")
				.addClass("alert alert-danger")
				.html("Service worker support missing in browser (are you using plain HTTP?).");
		}

		show_covers();
		mark_offline_books();
		cache_refresh();

	});
</script>

<div class="container container-main">

<div class="modal fade" id="summary-modal" tabindex="-1" role="dialog">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h4 class="modal-title">Summary</h4>
      </div>
      <div class="modal-body">
			<div class="book-summary"> </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<div style="display : none" class="alert alert-info dl-progress"></div>

<?php

	require_once "config.php";

	$db = new PDO('sqlite:' . CALIBRE_DB);

	$ids_qpart = "1";

	if ($mode == "favorites") {
		$fav_sth = $ldb->prepare("SELECT bookid FROM epube_favorites WHERE owner = ?");
		$fav_sth->execute([$owner]);

		$fav_ids = [];

		while ($line = $fav_sth->fetch()) {
			array_push($fav_ids, $line["bookid"]);
		}

		$ids_qpart = "books.id IN (" . implode(",", $fav_ids) . ")";
	}

	$limit = 60;
	@$offset = (int) $_REQUEST["offset"];

	$order_by = $query ? "author_sort, series_name, series_index, title, books.id" : "books.id DESC";

	$sth = $db->prepare("SELECT books.*, s.name AS series_name,
		(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
		LEFT JOIN books_series_link AS bsl ON (bsl.book = books.id)
		LEFT JOIN series AS s ON (bsl.series = s.id)
		WHERE
			((:query = '') OR
				(
					LOWER(books.author_sort) LIKE LOWER(:query) OR
					LOWER(books.title) LIKE LOWER(:query) OR
					LOWER(series_name) LIKE LOWER(:query)
				))
			AND $ids_qpart
		ORDER BY $order_by LIMIT :limit OFFSET :offset");

	$sth->execute([':limit' => $limit, ':offset' => $offset, ':query' => '%' . $query . '%']);

	print "<div class='row display-flex'>";

	$rows = 0;

	while ($line = $sth->fetch()) {
		++$rows;

		if ($line['has_cover']) {
			$cover_filename = BOOKS_DIR . "/" . $line["path"] . "/" . "cover.jpg";

			if (file_exists($cover_filename))
				$cover_mtime = filemtime($cover_filename);
			else
				$cover_mtime = 0;

			$cover_link = "backend.php?" . http_build_query(["op" => "cover", "id" => $line["id"], "ts" => $cover_mtime]);
		} else {
			$cover_link = "";
		}

		$author_link = "?" . http_build_query(["query" => $line["author_sort"]]);

		$in_progress = false;
		$is_read = false;

		if ($line["epub_id"]) {
			$read_link = "read.html?" . http_build_query(["id" => $line["epub_id"], "rt" => $mode, "b" => $line["id"]]);

			$lastread_sth = $ldb->prepare("SELECT lastread, total_pages FROM epube_books, epube_pagination
				WHERE epube_pagination.bookid = epube_books.bookid AND
					epube_books.bookid = ? AND owner = ?");
			$lastread_sth->execute([$line['epub_id'], $owner]);

			if ($lastread_line = $lastread_sth->fetch()) {
				$lastread = $lastread_line["lastread"];
				$total_pages = $lastread_line["total_pages"];

				$is_read = $total_pages - $lastread < 5;
				$in_progress = $lastread > 1;
			}

		} else {
			$read_link = "";
		}

		$cover_class = $is_read ? "read" : "";
		$title_class = $in_progress ? "in_progress" : "";

		if ($line["series_name"]) {
			$series_link = "?" . http_build_query(["query" => $line["series_name"]]);
			$series_full = $line["series_name"] . " [" . $line["series_index"] . "]";
		} else {
			$series_link = "";
			$series_full = "";
		}

		$data_sth = $db->prepare("SELECT * FROM data WHERE book = ? LIMIT 3");
		$data_sth->execute([$line['id']]);

		?>
			<div class="col-xs-6 col-sm-3 col-md-2" id="cell-<?php echo $line["id"] ?>">
				<?php if ($read_link) { ?>
					<a class="thumbnail <?php echo $cover_class ?>" href="<?php echo $read_link ?>">
				<?php } else { ?>
					<span class="thumbnail <?php echo $cover_class ?>">
				<?php } ?>

					<img style="display : none" data-book-id="<?php echo $line['id'] ?>" data-cover-link="<?php echo $cover_link ?>">

				<?php if ($read_link) { ?>
					</a>
				<?php } else { ?>
					</span>
				<?php } ?>

				<div class="caption">
					<div title="<?php echo htmlspecialchars($line['title']) ?>" class="<?php echo $title_class ?>">
						<?php if ($read_link) { ?>
							<a href="<?php echo $read_link ?>"><?php echo $line['title'] ?></a>
						<?php } else { ?>
							<?php echo $line['title'] ?>
						<?php } ?>
					</div>

					<div><a title="<?php echo htmlspecialchars($series_full) ?>" href="<?php echo $series_link ?>">
							<?php echo $series_full ?></a></div>

 					<div><a title="<?php echo htmlspecialchars($line["author_sort"]) ?>" href="<?php echo $author_link ?>">
						<?php echo $line["author_sort"] ?></a></div>

				</div>

				<div class="dropdown" style="white-space : nowrap">
				  <a href="#" data-toggle="dropdown" role="button">
				  		More...
						<span class="caret"></span>
		  			</a>

					<ul class="dropdown-menu" aria-labelledby="dLabel">
						<?php

							$fav_sth = $ldb->prepare("SELECT id FROM epube_favorites
								WHERE bookid = ?  AND owner = ? LIMIT 1");
							$fav_sth->execute([$line['id'], $owner]);

							$found_id = false;

							while ($fav_line = $fav_sth->fetch()) {
								$found_id = $fav_line["id"];
							}

							if ($found_id) {
								$toggle_fav_prompt = "Remove from favorites";
								$fav_attr = "1";
							} else {
								$toggle_fav_prompt = "Add to favorites";
								$fav_attr = "0";
							}
						?>

						<li><a href="#" onclick="return show_summary(this)"
							data-book-id="<?php echo $line["id"] ?>">Summary</a></li>

						<li><a href="#" onclick="return toggle_fav(this)"
							data-is-fav="<?php echo $fav_attr ?>"
							class="fav_item" data-book-id="<?php echo $line["id"] ?>">
							<?php echo $toggle_fav_prompt ?></a></li>

						<?php if ($line["epub_id"]) { ?>
						<li><a href="#" onclick=""
							data-book-id="<?php echo $line["id"] ?>" class="offline_dropitem"></a></li>
						<li class="divider"></li>
						<?php } ?>

						<?php while ($data_line = $data_sth->fetch()) {
							if ($data_line["format"] != "ORIGINAL_EPUB") {
								$label_class = $data_line["format"] == "EPUB" ? "label-success" : "label-primary";

								$download_link = "backend.php?op=download&id=" . $data_line["id"];

								print "<li><a target=\"_blank\" href=\"$download_link\">Download: <span class=\"label $label_class\">" .
									$data_line["format"] . "</span></a></li>";
							}
						} ?>
					</ul>
				</div>
			</div>
		<?php } /* while */ ?>

	</div>

	<?php
		$prev_link = http_build_query(["mode" => $mode, "query" => $query, "offset" => $offset - $limit]);
		$next_link = http_build_query(["mode" => $mode, "query" => $query, "offset" => $offset + $limit]);
	?>

	<ul class="pager">
		<?php if ($offset > 0) { ?>
		<li class="previous"><a href="?<?php echo $prev_link ?>">&larr; Previous</a></li>
		<?php } else { ?>
		<li class="previous disabled"><a href="#">&larr; Previous</a></li>
		<?php } ?>

		<?php if ($rows == $limit) { ?>
			<li class="next"><a href="?<?php echo $next_link ?>">Next&rarr;</a></li>
		<?php } else { ?>
			<li class="next disabled"><a href="#">Next&rarr;</a></li>
		<?php } ?>
	</ul>
</div>
</body>
</html>

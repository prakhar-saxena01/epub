<?php
	require_once "config.php";
	require_once "include/functions.php";

	$link = db_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
	init_connection($link);
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
	<script src="lib/holder.min.js"></script>
	<title>The Epube</title>
	<link type="text/css" rel="stylesheet" media="screen" href="css/index.css" />
	<link id="favicon" rel="shortcut icon" type="image/png" href="img/favicon.png" />
</head>
<body>

<?php
	$query = $_REQUEST["query"];
?>

<div class="navbar navbar-default navbar-static-top">
<div class="container">
	<div class="navbar-header">
		<span class="navbar-brand"><a href="?">The Epube</a> (<?php echo $_SERVER["PHP_AUTH_USER"] ?>)</span>

		<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#nav-collapse" aria-expanded="false">
			<span class="sr-only">Toggle navigation</span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
			<span class="icon-bar"></span>
		</button>

	</div>

	<div class="collapse navbar-collapse" id="nav-collapse">

		<ul class="nav navbar-nav">
		</ul>

		<form class="navbar-form navbar-right">
			<input type="text" name="query" class="form-control"
				value="<?php echo htmlspecialchars($query) ?>">
			<button type="submit" class="btn btn-default">Search</button>
		</form>

	</div>

</div>
</div>


<div class="container">

<?php

	require_once "config.php";
	require_once "include/functions.php";

	$owner = db_escape_string($_SERVER["PHP_AUTH_USER"]);

	if (!$owner) {
		print "<h1>Not authenticated</h1>";
		die;
	}

	$db = new SQLite3(CALIBRE_DB, SQLITE3_OPEN_READONLY);

	if ($query) {
		$query_esc = db_escape_string($query);
		$search_qpart = "(LOWER(books.author_sort) LIKE LOWER('%$query_esc%') OR
			LOWER(books.title) LIKE LOWER('%$query_esc%') OR
			LOWER(series_name) LIKE LOWER('%$query_esc%'))";
	} else {
		$search_qpart = "1";
	}

	$limit = 60;
	$offset = (int) $_REQUEST["offset"];

	$order_by = $query ? "author_sort, series_name, series_index, title, books.id" : "books.id DESC";

	$result = $db->query("SELECT books.*, s.name AS series_name,
		(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
		LEFT JOIN books_series_link AS bsl ON (bsl.book = books.id)
		LEFT JOIN series AS s ON (bsl.series = s.id)
		WHERE $search_qpart ORDER BY $order_by LIMIT $limit OFFSET $offset");

	print "<div class='row'>";

	$rows = 0;

	while ($line = $result->fetchArray(SQLITE3_ASSOC)) {
		++$rows;

		$cover_link = "backend.php?" . http_build_query(["op" => "cover", "id" => $line["id"]]);
		$author_link = "?" . http_build_query(["query" => $line["author_sort"]]);

		$in_progress = false;
		$is_read = false;

		if ($line["epub_id"]) {
			$read_link = "read.html?" . http_build_query(["id" => $line["epub_id"]]);

			$lastread_result = db_query($link, "SELECT lastread, total_pages FROM epube_books, epube_pagination
				WHERE epube_pagination.bookid = epube_books.bookid AND
					epube_books.bookid = " . $line["epub_id"] . " AND owner = '$owner'");

			if (db_num_rows($lastread_result) > 0) {
				$lastread = db_fetch_result($lastread_result, 0, "lastread");
				$total_pages = db_fetch_result($lastread_result, 0, "total_pages");

				$is_read = $total_pages - $lastread < 5;
				$in_progress = $lastread > 1;

			}

		} else {
			$read_link = "";
		}

		$cover_read = $is_read ? "read" : "";

		print "<div class='col-xs-6 col-sm-3 col-md-2 index_cell'>";
		print "<div class=\"thumb $cover_read\">";

		if ($read_link) print "<a href=\"$read_link\">";

		if ($line["has_cover"]) {
			print "<img src='$cover_link'>";
		} else {
			print "<img data-src='holder.js/120x180'>";
		}

		if ($read_link) print "</a>";

		print "<div class='caption'>";

		$title_class = $in_progress ? "in_progress" : "";

		print "<div title=\"".htmlspecialchars($line["title"])."\" class=\"$title_class\">";

		if ($read_link) {
			print "<a href=\"$read_link\">" . $line["title"] . "</a>";
		} else {
			print $line["title"];
		}

		print "</div>";

		if ($line["series_name"]) {
			$series_link = "?" . http_build_query(["query" => $line["series_name"]]);
			$series_full = $line["series_name"] . " [" . $line["series_index"] . "]";

			print "<div><a title=\"".htmlspecialchars($series_full)."\"
				href=\"$series_link\">$series_full</a></div>";
		}

		print "<div><a title=\"".htmlspecialchars($line["author_sort"])."\"
			href=\"$author_link\">" . $line["author_sort"] . "</a></div>";

		$data_result = $db->query("SELECT * FROM data WHERE book = " . $line["id"] . " LIMIT 3");

		while ($data_line = $data_result->fetchArray(SQLITE3_ASSOC)) {
			if ($data_line["format"] != "ORIGINAL_EPUB") {
				$download_link = "backend.php?op=download&id=" . $data_line["id"];
				print "<a target=\"_blank\" href=\"$download_link\"><span class='label label-primary'>" . $data_line["format"] . "</span></a> ";
			}
		}


		print "</div>";
		print "</div>";
		print "</div>";

	}

	?>

	</div>

	<?php
		$prev_link = http_build_query(["query" => $query, "offset" => $offset - $limit]);
		$next_link = http_build_query(["query" => $query, "offset" => $offset + $limit]);
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

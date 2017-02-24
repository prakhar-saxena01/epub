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
		$search_qpart = "(LOWER(author_sort) LIKE LOWER('%$query_esc%') OR LOWER(title) LIKE LOWER('%$query_esc%'))";
	} else {
		$search_qpart = "1";
	}

	$limit = 60;
	$offset = (int) $_REQUEST["offset"];

	$result = $db->query("SELECT books.*,
		(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
		WHERE $search_qpart ORDER BY books.id DESC LIMIT $limit OFFSET $offset");

	print "<div class='row'>";

	while ($line = $result->fetchArray(SQLITE3_ASSOC)) {

		$cover_link = "backend.php?" . http_build_query(["op" => "cover", "id" => $line["id"]]);
		$author_link = "?" . http_build_query(["query" => $line["author_sort"]]);
		$read_link = $line["epub_id"] ? "read.html?" . http_build_query(["id" => $line["epub_id"]]) : "";

		print "<div class='col-xs-6 col-sm-3 col-md-2' style='height : 250px'>";
		print "<div class='thumb'>";

		if ($read_link) print "<a href=\"$read_link\">";

		if ($line["has_cover"]) {
			print "<img src='$cover_link'>";
		} else {
			print "<img src='holder.js/120x180'>";
		}

		if ($read_link) print "</a>";

		print "<div class='caption'>";

		if ($read_link) {
			print "<div><a href=\"$read_link\">" . $line["title"] . "</a></div>";
		} else {
			print "<div>" . $line["title"] . "</div>";
		}

		print "<div><a href=\"$author_link\">" . $line["author_sort"] . "</a></div>";

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
		$prev_link = http_build_query(["query" => $query, "offset" => $offset > 0 ? $offset - $limit : 0]);
		$next_link = http_build_query(["query" => $query, "offset" => $offset + $limit]);
	?>

	<ul class="pager">
		<li class="previous"><a href="?<?php echo $prev_link ?>">&larr; Previous</a></li>
		<li class="next"><a href="?<?php echo $next_link ?>">Next&rarr;</a></li>
	</ul>

</div>
</body>
</html>

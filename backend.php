<?php

	require_once "config.php";
	require_once "include/functions.php";

	$op = $_REQUEST["op"];

	header("Content-type: text/json");

	$link = db_connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
	init_connection($link);

	$owner = db_escape_string($_SERVER["PHP_AUTH_USER"]);

	if (!$owner) {
		print json_encode(["error" => "NOT_AUTHENTICATED"]);
		die;
	}

	ob_start("ob_gzhandler");

	switch ($op) {
	case "cover":
		$id = (int) $_REQUEST["id"];

		$db = new SQLite3(CALIBRE_DB, SQLITE3_OPEN_READONLY);
		$result = $db->query("SELECT has_cover, path FROM books WHERE id = " . $id);

		while ($line = $result->fetchArray(SQLITE3_ASSOC)) {
			$filename = BOOKS_DIR . "/" . $line["path"] . "/" . "cover.jpg";

			if (file_exists($filename)) {
				$base_filename = basename($filename);

				header("Content-type: " . mime_content_type($filename));
				header('Cache-control: max-age= ' . (86400*24));

				readfile($filename);
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}

		break;

	case "download":
		$id = (int) $_REQUEST["id"];

		$db = new SQLite3(CALIBRE_DB, SQLITE3_OPEN_READONLY);
		$result = $db->query("SELECT path, name, format FROM data LEFT JOIN books ON (data.book = books.id) WHERE data.id = " . $id);

		while ($line = $result->fetchArray(SQLITE3_ASSOC)) {
			$filename = BOOKS_DIR . "/" . $line["path"] . "/" . $line["name"] . "." . strtolower($line["format"]);

			if (file_exists($filename)) {
				$base_filename = basename($filename);

				header("Content-type: " . mime_content_type($filename));
				header("Content-Disposition: attachment; filename=\"$base_filename\"");

				readfile($filename);
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}

		break;

	case "getpagination":
		$bookid = (int) $_REQUEST["id"];

		if ($bookid) {
			$result = db_query($link, "SELECT pagination FROM epube_pagination WHERE bookid = '$bookid' LIMIT 1");

			if (db_num_rows($result) != 0) {
				print db_fetch_result($result, 0, "pagination");
			} else {
				print json_encode(["error" => "NOT_FOUND"]);
			}
		}

		break;
	case "storepagination":
		$bookid = (int) $_REQUEST["id"];
		$payload = db_escape_string($_REQUEST["payload"]);
		$total_pages = (int) $_REQUEST["total"];

		if ($bookid && $payload && $total_pages) {

			db_query($link, "BEGIN");

			$result = db_query($link, "SELECT id FROM epube_pagination WHERE bookid = '$bookid' LIMIT 1");

			if (db_num_rows($result) != 0) {
				$id = db_fetch_result($result, 0, "id");

				db_query($link, "UPDATE epube_pagination SET pagination = '$payload',
					total_pages = '$total_pages' WHERE id = '$id'");

			} else {
				db_query($link, "INSERT INTO epube_pagination (bookid, pagination, total_pages) VALUES
					('$bookid', '$payload', '$total_pages')");

			}

			db_query($link, "COMMIT");
		}

		break;
	case "getlastread":
		$bookid = (int) $_REQUEST["id"];
		$lastread = 0;

		if ($bookid) {

			$result = db_query($link, "SELECT id, lastread FROM epube_books
				WHERE bookid = '$bookid' AND owner = '$owner' LIMIT 1");

			if (db_num_rows($result) != 0) {
				$lastread = (int) db_fetch_result($result, 0, "lastread");
			}
		}

		print json_encode(["lastread" => $lastread]);

		break;

	case "storelastread":
		$page = (int) $_REQUEST["page"];
		$bookid = (int) $_REQUEST["id"];

		if ($page && $bookid) {

			db_query($link, "BEGIN");

			$result = db_query($link, "SELECT id, lastread FROM epube_books
				WHERE bookid = '$bookid' AND owner = '$owner' LIMIT 1");

			if (db_num_rows($result) != 0) {
				$id = db_fetch_result($result, 0, "id");
				$lastread = (int) db_fetch_result($result, 0, "lastread");

				if ($lastread < $page || $page == -1) {

					if ($page == -1) $page = 0;

					db_query($link, "UPDATE epube_books SET lastread = '$page' WHERE id = '$id'");
				}
			} else {
				db_query($link, "INSERT INTO epube_books (bookid, owner, lastread) VALUES
					('$bookid', '$owner', '$page')");

			}

			db_query($link, "COMMIT");
		}

		print json_encode(["lastread" => $page]);

		break;

	default:
		print json_encode(["error" => "UNKNOWN_METHOD"]);
	}


?>

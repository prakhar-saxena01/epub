<?php

	require_once "config.php";

	$op = $_REQUEST["op"];

	header("Content-type: text/json");

	$ldb = new SQLite3(SCRATCH_DB);
	$ldb->busyTimeout(30*1000);

	$owner = SQLite3::escapeString($_SERVER["PHP_AUTH_USER"]);

	if (!$owner) {
		header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
		echo "Unauthorized";
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

	case "getinfo":
		$id = (int) $_REQUEST["id"];

		$db = new SQLite3(CALIBRE_DB, SQLITE3_OPEN_READONLY);

		$result = $db->query("SELECT books.*, s.name AS series_name,
			(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
			LEFT JOIN books_series_link AS bsl ON (bsl.book = books.id)
			LEFT JOIN series AS s ON (bsl.series = s.id)
			WHERE books.id = " . $id);

		if ($line = $result->fetchArray(SQLITE3_ASSOC)) {
			print json_encode($line);
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
			$result = $ldb->query("SELECT pagination FROM epube_pagination WHERE bookid = '$bookid' LIMIT 1");

			if ($line = $result->fetchArray()) {
				print $line["pagination"];
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}

		break;
	case "storepagination":
		$bookid = (int) $_REQUEST["id"];
		$payload = SQLite3::escapeString($_REQUEST["payload"]);
		$total_pages = (int) $_REQUEST["total"];

		if ($bookid && $payload && $total_pages) {

			$ldb->query("BEGIN");

			$result = $ldb->query("SELECT id FROM epube_pagination WHERE bookid = '$bookid' LIMIT 1");

			if ($line = $result->fetchArray()) {
				$id = $line["id"];

				$ldb->query("UPDATE epube_pagination SET pagination = '$payload',
					total_pages = '$total_pages' WHERE id = '$id'");

			} else {
				$ldb->query("INSERT INTO epube_pagination (bookid, pagination, total_pages) VALUES
					('$bookid', '$payload', '$total_pages')");

			}

			$ldb->query("COMMIT");
		}

		break;
	case "getlastread":
		$bookid = (int) $_REQUEST["id"];
		$lastread = 0;
		$lastcfi = "";
		$totalpages = 0;

		if ($bookid) {

			$result = $ldb->query("SELECT b.lastread, b.lastcfi, p.total_pages FROM epube_books AS b, epube_pagination AS p
				WHERE b.bookid = p.bookid AND b.bookid = '$bookid' AND b.owner = '$owner' LIMIT 1");

			if ($line = $result->fetchArray()) {
				$lastread = (int) $line["lastread"];
				$lastcfi = $line["lastcfi"];
				$totalpages = (int) $line["total_pages"];
			}
		}

		print json_encode(["page" => $lastread, "cfi" => $lastcfi, "total" => $totalpages]);

		break;

	case "storelastread":
		$page = (int) $_REQUEST["page"];
		$bookid = (int) $_REQUEST["id"];
		$cfi = SQLite3::escapeString($_REQUEST["cfi"]);

		if ($page && $bookid) {

			$ldb->query("BEGIN");

			$result = $ldb->query("SELECT id, lastread, lastcfi FROM epube_books
				WHERE bookid = '$bookid' AND owner = '$owner' LIMIT 1");

			if ($line = $result->fetchArray()) {
				$id = $line["id"];
				$lastread = (int) $line["lastread"];

				if ($lastread < $page || $page == -1) {

					if ($page == -1) $page = 0;

					$ldb->query("UPDATE epube_books SET lastread = '$page', lastcfi = '$cfi' WHERE id = '$id'");
				}
			} else {
				$ldb->query("INSERT INTO epube_books (bookid, owner, lastread, lastcfi) VALUES
					('$bookid', '$owner', '$page', '$cfi')");

			}

			$ldb->query("COMMIT");
		}

		print json_encode(["page" => $page, "cfi" => $cfi]);

		break;

	case "define":

		if (defined('DICT_ENABLED') && DICT_ENABLED) {

			$word = escapeshellarg($_REQUEST["word"]);

			exec(DICT_CLIENT . " -h ". DICT_SERVER ." $word 2>&1", $output, $rc);

			if ($rc == 0) {
				print json_encode(["result" => $output]);

			} else if ($rc == 21) {

				$word_matches = [];

				foreach ($output as $line) {
					if (preg_match('/^[^ ]+: *(.*)/', $line, $match)) {

						if ($match[1]) {
							$word_matches = explode("  ", $match[1]);
							break;
						}
					}
				}

				$word_matches = implode(" ", array_map("escapeshellarg", $word_matches));

				unset($output);
				exec(DICT_CLIENT . " -h ". DICT_SERVER ." $word_matches 2>&1", $output, $rc);

				if ($rc == 0) {
					print json_encode(["result" => $output]);
				}
			} else if ($rc == 20) {

				exec(DICT_CLIENT . " -s soundex -h ". DICT_SERVER ." $word 2>&1", $output, $rc);

				print json_encode(["result" => $output]);

			} else {
				print json_encode(["result" => $output]);
			}
		}

		break;

	default:
		header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
		echo "Method not found.";
	}


?>

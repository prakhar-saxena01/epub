<?php

	require_once "config.php";

	header("Content-type: text/json");

	define('STATIC_EXPIRES', 86400*14);

	require_once "sessions.php";
	require_once "db.php";

	@$owner = $_SESSION["owner"];

	if (!$owner) {
		header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
		echo "Unauthorized";
		die;
	}

	$op = $_REQUEST["op"];

	$ldb = Db::get();

	ob_start("ob_gzhandler");

	switch ($op) {
	case "cover":
		$id = (int) $_REQUEST["id"];

		$db = new PDO('sqlite:' . CALIBRE_DB);
		$sth = $db->prepare("SELECT has_cover, path FROM books WHERE id = ?");
		$sth->execute([$id]);

		while ($line = $sth->fetch()) {
			$filename = BOOKS_DIR . "/" . $line["path"] . "/" . "cover.jpg";

			if (file_exists($filename)) {
				$base_filename = basename($filename);

				header("Content-type: " . mime_content_type($filename));
				header('Cache-control: max-age=' . STATIC_EXPIRES);
				header("Expires: " . gmdate("D, d M Y H:i:s \G\M\T", time()+STATIC_EXPIRES));

				readfile($filename);
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}

		break;
	case "getowner":
		print json_encode(["owner" => $owner]);
		break;
	case "getinfo":
		$id = (int) $_REQUEST["id"];

		$db = new PDO('sqlite:' . CALIBRE_DB);

		$sth = $db->prepare("SELECT books.*, s.name AS series_name,
			(SELECT text FROM comments WHERE book = books.id) AS comment,
			(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
			LEFT JOIN books_series_link AS bsl ON (bsl.book = books.id)
			LEFT JOIN series AS s ON (bsl.series = s.id)
			WHERE books.id = ?");
		$sth->execute([$id]);

		if ($line = $sth->fetch()) {
			print json_encode($line);
		}

		break;

	case "togglefav":
		$id = (int) $_REQUEST["id"];

		$sth = $ldb->prepare("SELECT id FROM epube_favorites WHERE bookid = ?
			AND owner = ? LIMIT 1");
		$sth->execute([$id, $owner]);

		$found_id = false;
		$status = -1;

		while ($line = $sth->fetch()) {
			$found_id = $line["id"];
		}

		if ($found_id) {
			$sth = $ldb->prepare("DELETE FROM epube_favorites WHERE id = ?");
			$sth->execute([$found_id]);

			$status = 0;
		} else {
			$sth = $ldb->prepare("INSERT INTO epube_favorites (bookid, owner) VALUES (?, ?)");
			$sth->execute([$id, $owner]);

			$status = 1;
		}

		print json_encode(["id" => $id, "status" => $status]);

	case "download":
		$id = (int) $_REQUEST["id"];

		$db = new PDO('sqlite:' . CALIBRE_DB);
		$sth = $db->prepare("SELECT path, name, format FROM data LEFT JOIN books ON (data.book = books.id) WHERE data.id = ?");
		$sth->execute([$id]);

		while ($line = $sth->fetch()) {
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
			$sth = $ldb->prepare("SELECT pagination FROM epube_pagination WHERE bookid = ? LIMIT 1");
			$sth->execute([$bookid]);

			if ($line = $sth->fetch()) {
				print $line["pagination"];
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}

		break;
	case "storepagination":
		$bookid = (int) $_REQUEST["id"];
		$payload = $_REQUEST["payload"];
		$total_pages = (int) $_REQUEST["total"];

		if ($bookid && $payload && $total_pages) {

			$ldb->beginTransaction();

			$sth = $ldb->prepare("SELECT id FROM epube_pagination WHERE bookid = ? LIMIT 1");
			$sth->execute([$bookid]);

			if ($line = $sth->fetch()) {
				$id = $line["id"];

				$sth = $ldb->prepare("UPDATE epube_pagination SET pagination = ?,
					total_pages = ? WHERE id = ?");
				$sth->execute([$payload, $total_pages, $id]);

			} else {
				$sth = $ldb->prepare("INSERT INTO epube_pagination (bookid, pagination, total_pages) VALUES
					(?, ?, ?)");
				$sth->execute([$bookid, $payload, $total_pages]);
			}

			$ldb->commit();
		}

		break;
	case "getlastread":
		$bookid = (int) $_REQUEST["id"];
		$lastread = 0;
		$lastcfi = "";
		$totalpages = 0;

		if ($bookid) {

			$sth = $ldb->prepare("SELECT b.lastread, b.lastcfi, p.total_pages FROM epube_books AS b, epube_pagination AS p
				WHERE b.bookid = p.bookid AND b.bookid = ? AND b.owner = ? LIMIT 1");
			$sth->execute([$bookid, $owner]);

			if ($line = $sth->fetch()) {
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
		$cfi = $_REQUEST["cfi"];

		if ($bookid) {

			$ldb->beginTransaction();

			$sth = $ldb->prepare("SELECT id, lastread, lastcfi FROM epube_books
				WHERE bookid = ? AND owner = ? LIMIT 1");
			$sth->execute([$bookid, $owner]);

			if ($line = $sth->fetch()) {
				$id = $line["id"];
				$lastread = (int) $line["lastread"];

				if ($lastread <= $page || $page == -1) {

					if ($page == -1) $page = 0;

					$sth = $ldb->prepare("UPDATE epube_books SET lastread = ?, lastcfi = ? WHERE id = ?");
					$sth->execute([$page, $cfi, $id]);
				}
			} else {
				$sth = $ldb->prepare("INSERT INTO epube_books (bookid, owner, lastread, lastcfi) VALUES
					(?, ?, ?, ?)");
				$sth->execute([$bookid, $owner, $page, $cfi]);
			}

			$ldb->commit();
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

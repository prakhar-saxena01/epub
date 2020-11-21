<?php

	require_once "config.php";

	header("Content-type: text/json");

	define('STATIC_EXPIRES', 86400*14);
	define('PAGE_RESET_PROGRESS', -1);

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
				header("Last-Modified: " .
					gmdate("D, d M Y H:i:s \G\M\T", filemtime($filename)));

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
		$lastts = 0;

		if ($bookid) {

			$sth = $ldb->prepare("SELECT b.lastread, b.lastcfi, b.lastts FROM epube_books AS b, epube_pagination AS p
				WHERE b.bookid = p.bookid AND b.bookid = ? AND b.owner = ? LIMIT 1");
			$sth->execute([$bookid, $owner]);

			if ($line = $sth->fetch()) {
				$lastread = (int) $line["lastread"];
				$lastcfi = $line["lastcfi"];
				$lastts = (int) $line["lastts"];
			}
		}

		print json_encode(["page" => $lastread, "cfi" => $lastcfi, "total" => 100, "timestamp" => $lastts]);

		break;

	case "storelastread":
		$page = (int) $_REQUEST["page"];
		$bookid = (int) $_REQUEST["id"];
		$timestamp = (int) $_REQUEST["timestamp"];
		$cfi = $_REQUEST["cfi"];

		if ($bookid) {

			$ldb->beginTransaction();

			$sth = $ldb->prepare("SELECT id, lastread, lastcfi, lastts FROM epube_books
				WHERE bookid = ? AND owner = ? LIMIT 1");
			$sth->execute([$bookid, $owner]);

			if ($line = $sth->fetch()) {
				$id = $line["id"];
				$last_timestamp = (int) $line["lastts"];
				$last_page = (int) $line["lastread"];

				if (($timestamp >= $last_timestamp) && ($page >= $last_page || $page == PAGE_RESET_PROGRESS)) {

					if ($page == PAGE_RESET_PROGRESS)
						$page = 0;

					$sth = $ldb->prepare("UPDATE epube_books SET lastread = ?, lastcfi = ?, lastts = ? WHERE id = ?");
					$sth->execute([$page, $cfi, $timestamp, $id]);
				}
			} else {
				$sth = $ldb->prepare("INSERT INTO epube_books (bookid, owner, lastread, lastcfi, lastts) VALUES
					(?, ?, ?, ?, ?)");
				$sth->execute([$bookid, $owner, $page, $cfi, $timestamp]);
			}

			$ldb->commit();
		}

		print json_encode(["page" => $page, "cfi" => $cfi]);

		break;

	case "wikisearch":
		$query = urlencode(strip_tags($_REQUEST['query']));
		$url = "https://en.wiktionary.org/w/api.php?titles=${query}&action=query&prop=extracts&format=json&exlimit=1";

		if ($resp = file_get_contents($url)) {
			print $resp;
		}

		break;
	case "define":
		if (defined('DICT_ENABLED') && DICT_ENABLED) {
			function parse_dict_reply($reply) {
				$tmp = [];

				foreach (explode("\n", $reply) as $line) {
					list ($code, $message) = explode(" ", $line, 2);

					if (!$code && $message)
						array_push($tmp, $message);
				}

				return $tmp;
			}

			/* strip hyphens */
			$word = strip_tags(str_replace("­", "", $_REQUEST["word"]));
			$orig_word = $word;

			$result = [];

			for ($i = 0; $i < 3; $i++) {
				$ch = curl_init();
				curl_setopt($ch, CURLOPT_URL, sprintf("dict://%s/define:%s", DICT_SERVER, $word));
				curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
				$dict_reply = curl_exec($ch);

				if ($dict_reply) {
					$ret_parsed = parse_dict_reply($dict_reply);

					if (count($ret_parsed) > 0) {
						array_push($result, "<strong>$word</strong>");

						$result = array_merge($result, $ret_parsed);
						break;
					} else {
						$word = mb_substr($word, 0, mb_strlen($word)-1);
					}

				} else {
					array_push($result, curl_error($ch));
				}

				curl_close($ch);
			}

			if (count($result) == 0)
				array_push($result, "No results for: <b>$orig_word</b>");

			print json_encode(["result" => $result]);
		} else {
			print json_encode(["result" => ["Dictionary lookups are disabled."]]);
		}

		break;

	default:
		header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
		echo "Method not found.";
	}


?>

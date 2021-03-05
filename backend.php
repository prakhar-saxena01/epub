<?php
	set_include_path(__DIR__ ."/include" . PATH_SEPARATOR .
		get_include_path());

	if (!isset($_COOKIE['epube_sid'])) {
		header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
		echo "Unauthorized";
		exit;
	}

	header("Content-type: text/json");

	require_once "common.php";
	require_once "sessions.php";

	Config::sanity_check();

	define('STATIC_EXPIRES', 86400*14);
	define('PAGE_RESET_PROGRESS', -1);

	if (!validate_session()) {
		header($_SERVER["SERVER_PROTOCOL"]." 401 Unauthorized");
		echo "Unauthorized";
		exit;
	}

	$owner = $_SESSION["owner"] ?? "";
	$op = $_REQUEST["op"] ?? "";

	switch ($op) {
	case "cover":
		$id = (int) $_REQUEST["id"];

		$db = new PDO('sqlite:' . Config::get(Config::CALIBRE_DB));
		$sth = $db->prepare("SELECT has_cover, path FROM books WHERE id = ?");
		$sth->execute([$id]);

		while ($line = $sth->fetch()) {
			$filename = Config::get(Config::BOOKS_DIR) . "/" . $line["path"] . "/" . "cover.jpg";

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

		$caldb = new PDO('sqlite:' . Config::get(Config::CALIBRE_DB));

		$sth = $caldb->prepare("SELECT books.*, s.name AS series_name,
			(SELECT text FROM comments WHERE book = books.id) AS comment,
			(SELECT id FROM data WHERE book = books.id AND format = 'EPUB' LIMIT 1) AS epub_id FROM books
			LEFT JOIN books_series_link AS bsl ON (bsl.book = books.id)
			LEFT JOIN series AS s ON (bsl.series = s.id)
			WHERE books.id = ?");
		$sth->execute([$id]);

		if ($row = $sth->fetch()) {
			print json_encode($row);
		} else {
			header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
			echo "Not found.";
		}
		break;

	case "togglefav":
		$bookid = (int) $_REQUEST["id"];

		$fav = ORM::for_table('epube_favorites')
			->where('bookid', $bookid)
			->where('owner', $owner)
			->find_one();

		if ($fav) {
			$fav->delete();

			$status = 0;
		} else {
			$fav = ORM::for_table('epube_favorites')
				->create();

			$fav->bookid = $bookid;
			$fav->owner = $owner;
			$fav->save();

			$status = 1;
		}

		print json_encode(["id" => $bookid, "status" => $status]);
		break;

	case "download":
		$bookid = (int) $_REQUEST["id"];

		$caldb = new PDO('sqlite:' . Config::get(Config::CALIBRE_DB));
		$sth = $caldb->prepare("SELECT path, name, format FROM data LEFT JOIN books ON (data.book = books.id) WHERE data.id = ?");
		$sth->execute([$bookid]);

		while ($row = $sth->fetch()) {
			$filename = Config::get(Config::BOOKS_DIR) . "/" . $row["path"] . "/" . $row["name"] . "." . strtolower($row["format"]);

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
			$pag = ORM::for_table('epube_pagination')
				->where('bookid', $bookid)
				->find_one();

			if ($pag) {
				print $pag->pagination;
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "File not found.";
			}
		}
		break;

	case "storepagination":
		$bookid = (int) $_REQUEST["id"];
		$payload = $_REQUEST["payload"];

		if ($bookid && $payload) {

			$pag = ORM::for_table('epube_pagination')
				->where('bookid', $bookid)
				->find_one();

			if (!$pag) {
				$pag = ORM::for_table('epube_pagination')
					->create();

				$pag->bookid = $bookid;
			}

			$pag->pagination = $payload;
			$pag->total_pages = 100;

			$pag->save();
		}
		break;

	case "getlastread":
		$bookid = (int) $_REQUEST["id"];
		$lastread = 0;
		$lastcfi = "";
		$lastts = 0;

		if ($bookid) {

			$book = ORM::for_table('epube_books')
				->where('bookid', $bookid)
				->where('owner', $owner)
				->find_one();

			if ($book) {
				print json_encode([
					"page" => (int)$book->lastread,
					"cfi" => $book->lastcfi,
					"total" => 100,
					"timestamp" => (int)$book->lastts]);
			} else {
				header($_SERVER["SERVER_PROTOCOL"]." 404 Not Found");
				echo "Not found.";
			}
		}
		break;

	case "storelastread":
		$page = (int) $_REQUEST["page"];
		$bookid = (int) $_REQUEST["id"];
		$timestamp = (int) $_REQUEST["timestamp"];
		$cfi = $_REQUEST["cfi"];

		if ($bookid) {

			$book = ORM::for_table('epube_books')
				->where('bookid', $bookid)
				->where('owner', $owner)
				->find_one();

			if ($book) {
				if (($timestamp >= $book->lastts) && ($page >= $book->lastread || $page == PAGE_RESET_PROGRESS)) {
					$book->set([
						'lastread' => $page,
						'lastcfi' => $cfi,
						'lastts' => $timestamp,
					]);
				}
			} else {
				$book = ORM::for_table('epube_books')->create();

				$book->set([
					'bookid' => $bookid,
					'owner' => $owner,
					'lastread' => $page,
					'lastcfi' => $cfi,
					'lastts' => $timestamp,
				]);
			}

			$book->save();
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
		if (Config::get(Config::DICT_SERVER)) {
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
				curl_setopt($ch, CURLOPT_URL, sprintf("dict://%s/define:%s", Config::get(Config::DICT_SERVER), $word));
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

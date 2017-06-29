<?php
	require_once "config.php";
	require_once "db.php";

	define('SESSION_LIFETIME', 365 * 86400);

	ini_set("session.name", "epube_sid");
	ini_set("session.use_only_cookies", true);
	ini_set("session.gc_maxlifetime", SESSION_LIFETIME);
	ini_set("session.cookie_lifetime", SESSION_LIFETIME);

	if (@$_SERVER['HTTPS'] == "on") {
		ini_set("session.cookie_secure", true);
	}

	session_set_cookie_params(SESSION_LIFETIME);

	function s_open ($s, $n) {
		return true;
	}

	function s_read ($id){
		$res = Db::get()->query("SELECT data FROM epube_sessions WHERE id='$id'");

		if ($line = $res->fetchArray(SQLITE3_ASSOC)) {
			return base64_decode($line["data"]);
		} else {
			$expire = time() + SESSION_LIFETIME;

			Db::get()->query("INSERT INTO epube_sessions (id, data, expire)
					VALUES ('$id', '', '$expire')");
		}

	}

	function s_write ($id, $data) {
		$data = base64_encode($data);
		$expire = time() + SESSION_LIFETIME;

		Db::get()->query("UPDATE epube_sessions SET data = '$data', expire = '$expire' WHERE id = '$id'");

		return true;
	}

	function s_close () {
		return true;
	}

	function s_destroy($id) {
		Db::get()->query("DELETE FROM epube_sessions WHERE id = '$id'");

		return true;
	}

	function s_gc ($expire) {
		Db::get()->query("DELETE FROM epube_sessions WHERE expire < " . time());

		return true;
	}

	if (defined('SQLITE_SESSION_STORE') && SQLITE_SESSION_STORE) {
		session_set_save_handler("s_open",
			"s_close", "s_read", "s_write",
			"s_destroy", "s_gc");
	} else {
		session_save_path(__DIR__ . "/sessions");
	}

	register_shutdown_function('session_write_close');

	session_start();
?>

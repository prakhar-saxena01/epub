<?php
	require_once "common.php";

	$session_name = Config::get(Config::SESSION_NAME);
	$session_expire = Config::get(Config::SESSION_LIFETIME);

	if (Config::is_server_https())
		ini_set("session.cookie_secure", "true");

	ini_set("session.name", "epube_sid");
	ini_set("session.use_only_cookies", "true");
	ini_set("session.gc_maxlifetime", $session_expire);
	ini_set("session.cookie_lifetime", "0");

	session_set_cookie_params($session_expire);

	session_save_path(dirname(__DIR__) . "/sessions");

	// prolong PHP session cookie
	if (isset($_COOKIE[$session_name]))
	setcookie($session_name,
		$_COOKIE[$session_name],
		time() + $session_expire,
		ini_get("session.cookie_path"),
		ini_get("session.cookie_domain"),
		ini_get("session.cookie_secure"),
		ini_get("session.cookie_httponly"));

	function validate_session() : bool {
		if (!empty($_SESSION["owner"])) {

			$user = ORM::for_table('epube_users')
				->where('user', $_SESSION['owner'])
				->find_one();

			if ($user && sha1($user->pass) == $_SESSION['pass_hash']) {
				return true;
			}
		}

		return false;
	}

	function logout_user() : void {
		if (session_status() == PHP_SESSION_ACTIVE) {
			session_destroy();

			if (isset($_COOKIE[session_name()])) {
				setcookie(session_name(), '', time()-42000, '/');
			}

			if (isset($_COOKIE["epube_csrf_token"])) {
				setcookie("epube_csrf_token", '', time()-42000, '/');
			}

			session_commit();
		}
	}

	register_shutdown_function('session_write_close');

	if (isset($_COOKIE[session_name()])) {
		if (session_status() != PHP_SESSION_ACTIVE)
			session_start();
	}
?>

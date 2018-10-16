<?php
	require_once "config.php";
	require_once "db.php";

	define('SESSION_LIFETIME', 365 * 86400);

	ini_set("session.name", "epube_sid");
	ini_set("session.use_only_cookies", true);
	ini_set("session.gc_maxlifetime", SESSION_LIFETIME);
	ini_set("session.cookie_lifetime", SESSION_LIFETIME);

	function logout_user() {
		session_destroy();

		if (isset($_COOKIE[session_name()])) {
		   setcookie(session_name(), '', time()-42000, '/');
		}

		session_commit();
	}

	if (@$_SERVER['HTTPS'] == "on") {
		ini_set("session.cookie_secure", true);
	}

	session_set_cookie_params(SESSION_LIFETIME);

	session_save_path(__DIR__ . "/sessions");

	register_shutdown_function('session_write_close');

	if (isset($_COOKIE[session_name()])) {
		session_start();
	}
?>

<?php
	ini_set('display_errors', "false");
	ini_set('display_startup_errors', "false");

	// config.php is optional
	if (stream_resolve_include_path("config.php"))
		require_once "config.php";

	require_once "autoload.php";

	/** its a dummy :( */
	function T_sprintf(mixed ...$args) : string {
		return sprintf(...$args);
	}

	function validate_csrf(string $csrf_token) : bool {
		return $csrf_token && hash_equals($_SESSION['csrf_token'] ?? "", $csrf_token);
	}

	function sql_bool_to_bool(mixed $s) : bool {
		return $s && ($s !== "f" && $s !== "false"); //no-op for PDO, backwards compat for legacy layer
	}

	function bool_to_sql_bool(bool $s) : int {
		return $s ? 1 : 0;
	}

	function read_stdin() : string {
		$fp = fopen("php://stdin", "r");

		if ($fp) {
			$line = trim(fgets($fp));
			fclose($fp);
			return $line;
		}

		return "";
	}

<?php
	require_once "db.php";

	function init_connection($link) {

		if (!$link) {
			if (DB_TYPE == "mysql") {
			print mysql_error();
		}
		// PG seems to display its own errors just fine by default.
			die("Connection failed.");
		}

		if (DB_TYPE == "pgsql") {
			pg_query($link, "set client_encoding = 'UTF-8'");
			pg_set_client_encoding("UNICODE");
			pg_query($link, "set datestyle = 'ISO, european'");
			pg_query($link, "set time zone '".DB_TIMEZONE."'");
		} else {
			if (defined('MYSQL_CHARSET') && MYSQL_CHARSET) {
				db_query($link, "SET NAMES " . MYSQL_CHARSET);
	//			db_query($link, "SET CHARACTER SET " . MYSQL_CHARSET);
			}
		}
	}


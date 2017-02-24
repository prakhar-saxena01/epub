<?php

require_once "config.php";

function db_reconnect($link, $host, $user, $pass, $db) {
	$attempts = 0;

	while ($attempts < 10) {

		if (!$link) $link = db_connect($host, $user, $pass, $db);

		$result = db_query($link, "SELECT NOW()", false);

		if (db_num_rows($result) == 1) {
//			echo "[db] connection successful.\n";
			return $link;
		} else {
//			echo "[db] connection failed; reconnect attempt $attempts.\n";
			$link = false;
			$attempts++;
			sleep(1);
		}
	}

	return false;
}

function db_connect($host, $user, $pass, $db) {
	if (DB_TYPE == "pgsql") {	
			  
		$string = "dbname=$db user=$user password=$pass";	
		
		if ($host) {
			$string .= " host=$host";
		}

		if (defined('DB_PORT')) {
			$string = "$string port=" . DB_PORT;
		}

		$link = pg_connect($string);

		if (!$link) {
			die("Connection failed: " . pg_last_error($link));
		}

		return $link;

	} else if (DB_TYPE == "mysql") {
		$link = mysql_connect($host, $user, $pass);
		if ($link) {
			$result = mysql_select_db($db, $link);			
			if (!$result) {
				die("Can't select DB: " . mysql_error($link));
			}			
			return $link;
		} else {
			die("Connection failed: " . mysql_error($link));
		}
	}
}

function db_escape_string($s) {
	if (DB_TYPE == "pgsql") {	
		return pg_escape_string($s);
	} else {
		return mysql_real_escape_string($s);
	}
}

function db_query($link, $query, $die_on_error = true) {
	if (DB_TYPE == "pgsql") {
		$result = pg_query($link, $query);
		if (!$result) {
			$query = htmlspecialchars($query); // just in case
			if ($die_on_error) {
				die("Query <i>$query</i> failed [$result]: " . pg_last_error($link) . "\n");			
			}
		}
		return $result;
	} else if (DB_TYPE == "mysql") {
		$result = mysql_query($query, $link);
		if (!$result) {
			$query = htmlspecialchars($query);
			if ($die_on_error) {
				die("Query <i>$query</i> failed: " . mysql_error($link) . "\n");
			}
		}
		return $result;
	}
}

function db_fetch_assoc($result) {
	if (DB_TYPE == "pgsql") {
		return pg_fetch_assoc($result);
	} else if (DB_TYPE == "mysql") {
		return mysql_fetch_assoc($result);
	}
}


function db_num_rows($result) {
	if (DB_TYPE == "pgsql") {
		return pg_num_rows($result);
	} else if (DB_TYPE == "mysql") {
		return mysql_num_rows($result);
	}
}

function db_fetch_result($result, $row, $param) {
	if (DB_TYPE == "pgsql") {
		return pg_fetch_result($result, $row, $param);
	} else if (DB_TYPE == "mysql") {
		// I hate incoherent naming of PHP functions
		return mysql_result($result, $row, $param);
	}
}

function db_unescape_string($str) {
	$tmp = str_replace("\\\"", "\"", $str);
	$tmp = str_replace("\\'", "'", $tmp);
	return $tmp;
}

function db_close($link) {
	if (DB_TYPE == "pgsql") {

		return pg_close($link);

	} else if (DB_TYPE == "mysql") {
		return mysql_close($link);
	}
}

function db_affected_rows($link, $result) {
	if (DB_TYPE == "pgsql") {
		return pg_affected_rows($result);
	} else if (DB_TYPE == "mysql") {
		return mysql_affected_rows($link);
	}
}

function db_last_error($link) {
	if (DB_TYPE == "pgsql") {
		return pg_last_error($link);
	} else if (DB_TYPE == "mysql") {
		return mysql_error($link);
	}
}

?>

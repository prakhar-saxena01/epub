#!/usr/bin/php
<?php
	require_once "config.php";
	require_once "db.php";

	$dbh = Db::get();

	$longopts = [ "add:", "del:", "list", "help" ];

	$options = getopt("", $longopts);

	if (count($options) == 0 || isset($options["help"])) {
		print "Manage Epube user database. Usage:
	--add USER:PASSWORD
	--del USER
	--list\n";
	}

	if (isset($options["del"])) {
		$user = SQLite3::escapeString($options["del"]);

		print "Deleting user $user...\n";
		$dbh->query("DELETE FROM epube_users WHERE user = '$user'");
	}

	if (isset($options["list"])) {
		$res = $dbh->query("SELECT id, user FROM epube_users ORDER BY user");

		while ($line = $res->fetchArray(SQLITE3_ASSOC)) {
			printf("%d. %s\n", $line["id"], $line["user"]);
		}

	}

	if (isset($options["add"])) {
		@list($user, $pass) = explode(":", $options["add"]);

		if (!$user || !$pass) {
			print "Not enough arguments.\n";
			exit;
		}

		$user = SQLite3::escapeString($user);
		$pass_hash = SQLite3::escapeString('SHA256:' . hash('sha256', "$user:$pass"));

		print "Adding user $user with password $pass...\n";

		$res = $dbh->query("SELECT user FROM epube_users WHERE user = '$user'");

		if ($line = $res->fetchArray(SQLITE3_ASSOC)) {
			print "User already exists.\n";
		} else {
			$dbh->query("INSERT INTO epube_users (user, pass)
					VALUES ('$user', '$pass_hash')");
		}

	}

?>

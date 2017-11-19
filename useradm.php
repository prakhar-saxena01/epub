<?php
	if (!defined('STDIN')) {
		print "Please run this script via PHP CLI interpreter (php ./useradm.php).";
		exit;
	}

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
		$user = $options["del"];

		print "Deleting user $user...\n";
		$sth = $dbh->prepare("DELETE FROM epube_users WHERE user = ?");

		$sth->execute([$user]);
	}

	if (isset($options["list"])) {
		$res = $dbh->query("SELECT id, user FROM epube_users ORDER BY user");

		while ($line = $res->fetch()) {
			printf("%d. %s\n", $line["id"], $line["user"]);
		}

	}

	if (isset($options["add"])) {
		@list($user, $pass) = explode(":", $options["add"]);

		if (!$user || !$pass) {
			print "Not enough arguments.\n";
			exit;
		}

		$user = trim(mb_strtolower($user));
		$pass_hash = 'SHA256:' . hash('sha256', "$user:" . trim($pass));

		print "Adding user $user with password $pass...\n";

		$sth = $dbh->prepare("SELECT user FROM epube_users WHERE user = ?");
		$sth->execute([$user]);

		if ($line = $sth->fetch()) {
			print "User already exists.\n";
		} else {
			$sth = $dbh->prepare("INSERT INTO epube_users (user, pass)
					VALUES (?, ?)");
			$sth->execute([$user, $pass_hash]);
		}

	}

?>

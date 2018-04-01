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
	--add USER
	--del USER
	--list\n";
	}

	if (isset($options["del"])) {
		$user = $options["del"];

		$sth = $dbh->prepare("SELECT id FROM epube_users WHERE user = ?");
		$sth->execute([$user]);

		if ($sth->fetch()) {
			print "Deleting user $user...\n";

			$sth = $dbh->prepare("DELETE FROM epube_users WHERE user = ?");
			$sth->execute([$user]);
		} else {
			print "User $user not found.\n";
		}
	}

	if (isset($options["list"])) {
		$res = $dbh->query("SELECT id, user FROM epube_users ORDER BY user");

		while ($line = $res->fetch()) {
			print $line["user"] . "\n";
		}

	}

	if (isset($options["add"])) {
		$user = $options["add"];

		if (!$user) {
			print "Not enough arguments.\n";
			exit;
		}

		print "Enter password for user $user: ";
		$pass = fgets(STDIN);

		$user = trim(mb_strtolower($user));
		$pass = trim($pass);
		$pass_hash = 'SHA256:' . hash('sha256', "$user:" . trim($pass));

		print "Adding user $user with password $pass...\n";

		$sth = $dbh->prepare("SELECT user FROM epube_users WHERE user = ?");
		$sth->execute([$user]);

		if ($line = $sth->fetch()) {
			print "User already exists, updating password.\n";

			$sth = $dbh->prepare("UPDATE epube_users SET pass = ? WHERE user = ?");
			$sth->execute([$pass_hash, $user]);

		} else {
			$sth = $dbh->prepare("INSERT INTO epube_users (user, pass)
					VALUES (?, ?)");
			$sth->execute([$user, $pass_hash]);
		}

	}

?>

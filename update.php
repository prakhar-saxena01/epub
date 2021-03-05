<?php
	if (php_sapi_name() != "cli") {
		header("Content-type: text/plain");
		print "Please run this script from the command line.\n";
		exit;
	}

	set_include_path(__DIR__ ."/include" . PATH_SEPARATOR .
		get_include_path());

	chdir(__DIR__);

	require_once "common.php";

	Config::sanity_check();

	$options = getopt("", [ "user-add:", "user-del:", "user-list", "update-schema:", "help" ]);

	if (count($options) == 0 || isset($options["help"])) {
		print "The Epube CLI management tool.\n";
		print "Options:\n";
		print "	--log-level\n";
		print "	--update-schema[=force-yes]\n";
		print "	--help\n";
		print "	--user-add USER[:PASSWORD]\n";
		print "	--user-del USER\n";
		print "	--user-list\n";
	}

	Debug::set_enabled(true);

	if (!isset($options['update-schema']) && Config::is_migration_needed()) {
		die("Schema version is wrong, please upgrade the database (--update-schema).\n");
	}

	if (isset($options["log-level"])) {
		Debug::set_loglevel((int)$options["log-level"]);
	}

	if (isset($options["update-schema"])) {
		if (Config::is_migration_needed()) {

			if ($options["update-schema"] != "force-yes") {
				Debug::log("Type 'yes' to continue.");

				if (read_stdin() != 'yes')
					exit;
			} else {
				Debug::log("Proceeding to update without confirmation.");
			}

			if (!isset($options["log-level"])) {
				Debug::set_loglevel(Debug::$LOG_VERBOSE);
			}

			$migrations = Config::get_migrations();
			$migrations->migrate();

		} else {
			Debug::log("Database schema is already at latest version.");
		}
	}

	if (isset($options["user-del"])) {

		$username = $options["user-del"];

		$user = ORM::for_table('epube_users')
			->where('user', $username)
			->find_one();

		if ($user) {
			Debug::log("Deleting user: $username");
			$user->delete();
		} else {
			Debug::log("User not found: $username");
		}
	}

	if (isset($options["user-list"])) {
		$users = ORM::for_table('epube_users')
			->find_many();

		foreach ($users as $user) {
			Debug::log("{$user->id}. {$user->user}");
		}
	}

	if (isset($options["user-add"])) {
		list ($username, $pass) = explode(":", $options["user-add"], 2);

		if (!$username) {
			Debug::log("Not enough arguments");
			exit;
		}

		if (empty($pass)) {
			print "Enter password for user $username: ";
			$pass = trim(read_stdin());
		}

		$username = mb_strtolower($username);

		$pass_hash = 'SHA256:' . hash('sha256', "$username:" . trim($pass));

		$user = ORM::for_table('epube_users')
			->where('user', $username)
			->find_one();

		if ($user) {
			Debug::log("User $username already exists, updating password.");
			$user->pass = $pass_hash;
			$user->save();
		} else {
			Debug::log("Adding user $username.");
			$user = ORM::for_table('epube_users')->create();
			$user->user = $username;
			$user->pass = $pass_hash;
			$user->save();
		}
	}

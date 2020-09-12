<?php

function sanity_check() {

	if (!is_writable(SCRATCH_DB)) {
		die(SCRATCH_DB . " is not writable");
	}

	if (!is_writable(dirname(SCRATCH_DB))) {
		die(dirname(SCRATCH_DB) . " directory is not writable");
	}

	try {
		$dbh = new PDO("sqlite:" . SCRATCH_DB);

		$res = $dbh->query("SELECT id FROM epube_users LIMIT 1");

		if (!$res) {
			die("Test query failed, is schema installed? (sqlite3 " . SCRATCH_DB . "< schema.sql)");
		}

	} catch (Exception $e) {
		die($e);
	}

}
<?php
	set_include_path(__DIR__ ."/include" . PATH_SEPARATOR .
		get_include_path());

	require_once "common.php";
	require_once "sessions.php";

	Config::sanity_check();

	logout_user();

	header("Location: login.php");
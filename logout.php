<?php
	require_once "config.php";
	require_once "sessions.php";

	logout_user();

	header("Location: login.php");

?>


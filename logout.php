<?php
	require_once "config.php";
	require_once "sessions.php";

	session_destroy();

	header("Location: login.php");

?>


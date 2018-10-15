<?php
	require_once "config.php";
	require_once "sessions.php";

	session_destroy();

	if (isset($_COOKIE[session_name()])) {
	   setcookie(session_name(), '', time()-42000, '/');
	}

	session_commit();

	header("Location: login.php");

?>


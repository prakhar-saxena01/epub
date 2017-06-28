<?php
	require_once "config.php";
	require_once "sessions.php";

	@$op = $_REQUEST["op"];

	if ($op == "perform-login") {
		$user = SQLite3::escapeString($_REQUEST["user"]);
		$password = SQLite3::escapeString('SHA256:' . hash('sha256', "$user:" . $_REQUEST["password"]));

		$dbh = Db::get();

		$res = $dbh->query("SELECT id FROM epube_users WHERE user = '$user' AND pass = '$password'");

		if ($line = $res->fetchArray(SQLITE3_ASSOC)) {
			$_SESSION["owner"] = $user;
			header("Location: index.php");
		}
	}

?>
<!DOCTYPE html>
<html>
<head>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="lib/bootstrap/v3/css/bootstrap.min.css" rel="stylesheet" media="screen">
	<link href="lib/bootstrap/v3/css/bootstrap-theme.min.css" rel="stylesheet" media="screen">
	<link href="lib/qtip2/jquery.qtip.min.css" rel="stylesheet" media="screen">
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
	<script src="lib/bootstrap/v3/js/jquery.js"></script>
	<script src="lib/bootstrap/v3/js/bootstrap.min.js"></script>
	<script src="lib/holder.min.js"></script>
	<script src="lib/localforage.min.js"></script>
	<script src="lib/qtip2/jquery.qtip.min.js"></script>
	<title>The Epube</title>
	<link type="text/css" rel="stylesheet" media="screen" href="css/index.css" />
	<link rel="shortcut icon" type="image/png" href="img/favicon.png" />
	<link rel="icon" sizes="192x192" href="img/favicon_hires.png">
	<link rel="manifest" href="manifest.json">
	<meta name="mobile-web-app-capable" content="yes">
	<script src="js/index.js"></script>
	<script src="js/common.js"></script>
</head>
<body>

<div class="navbar navbar-default navbar-static-top">
<div class="container">
	<div class="navbar-header">
		<span class="navbar-brand"><a href="?">The Epube</a></span>
	</div>
</div>
</div>

<div class="container">

	<form>
		<input type="hidden" name="op" value="perform-login">

		<div class="form-group">
			<label>User</label>
			<input class="form-control" required="true" name="user">
		</div>
		<div class="form-group">
			<label>Password</label>
			<input type="password" class="form-control" name="password" required="true">
		</div>
		<button type="submit" class="btn btn-default">Log in</button>
	</form>

</div>

</body>
</html>

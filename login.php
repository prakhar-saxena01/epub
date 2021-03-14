<?php
	set_include_path(__DIR__ ."/include" . PATH_SEPARATOR .
	get_include_path());

	require_once "common.php";
	require_once "sessions.php";

	Config::sanity_check();

	$op = $_REQUEST["op"] ?? "";

	$login_notice = "";

	if ($op == "perform-login") {
		$username = trim(mb_strtolower($_REQUEST["user"]));
		$pass_hash = 'SHA256:' . hash('sha256', "$username:" . trim($_REQUEST["password"]));

		$user = ORM::for_table('epube_users')
			->where('user', $username)
			->where('pass', $pass_hash)
			->find_one();

		if ($user) {
			if (session_status() != PHP_SESSION_ACTIVE)
				session_start();

			session_regenerate_id(true);

			$_SESSION["owner"] = $username;
			$_SESSION["pass_hash"] = sha1($user->pass);
			$_SESSION["csrf_token"] = bin2hex(random_bytes(16));

			header("Location: index.php");
			exit;

		} else {
			$login_notice = "Incorrect username or password";
		}
	} else {
		logout_user();
	}
?>
<!DOCTYPE html>
<html>
	<head>
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link href="lib/bootstrap/v3/css/bootstrap.min.css" rel="stylesheet" media="screen">
		<link href="lib/bootstrap/v3/css/bootstrap-theme.min.css" rel="stylesheet" media="screen">
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<script src="dist/app-libs.min.js"></script>
		<title>The Epube</title>
		<link type="text/css" rel="stylesheet" media="screen" href="dist/app.min.css" />
		<link rel="shortcut icon" type="image/png" href="img/favicon.png" />
		<link rel="manifest" href="manifest.json">
		<meta name="mobile-web-app-capable" content="yes">
		<script type="text/javascript">
			$(document).ready(function() {
					/* global EpubeApp */

					if (typeof EpubeApp != "undefined") {
						EpubeApp.setPage("PAGE_LOGIN");
					}
			});
		</script>
	</head>
	<body class="epube-login">
		<div class="navbar navbar-default navbar-static-top">
		<div class="container">
			<div class="navbar-header">
				<span class="navbar-brand"><a href="?">The Epube</a></span>
			</div>
		</div>
		</div>

		<div class="container">
			<?php if ($login_notice) { ?>
				<div class="alert alert-danger"><?php echo $login_notice ?></div>
			<?php } ?>

			<form method="post">
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

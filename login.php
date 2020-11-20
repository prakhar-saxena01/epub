<?php
	require_once "config.php";
	require_once "common.php";

	sanity_check();

	require_once "sessions.php";

	@$op = $_REQUEST["op"];

	$login_notice = "";

	if ($op == "perform-login") {
		$user = trim(mb_strtolower($_REQUEST["user"]));
		$password = 'SHA256:' . hash('sha256', "$user:" . trim($_REQUEST["password"]));

		require_once "db.php";

		$dbh = Db::get();

		$sth = $dbh->prepare("SELECT id FROM epube_users WHERE user = ? AND pass = ?");
		$sth->execute([$user, $password]);

		if ($line = $sth->fetch()) {

			session_start();
			session_regenerate_id(true);

			$_SESSION["owner"] = $user;
			header("Location: index.php");
		} else {
			$login_notice = "Incorrect username or password";
		}
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

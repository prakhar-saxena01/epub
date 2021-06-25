<?php
class Config {
	private const _ENVVAR_PREFIX = "EPUBE_";

	const T_BOOL = 1;
	const T_STRING = 2;
	const T_INT = 3;

	// override defaults, defined below in _DEFAULTS[], via environment: DB_TYPE becomes EPUBE_DB_TYPE, etc

	const DB_TYPE = "DB_TYPE";
	const SCRATCH_DB = "SCRATCH_DB";
	const CALIBRE_DB = "CALIBRE_DB";
	const BOOKS_DIR = "BOOKS_DIR";
	const DICT_SERVER = "DICT_SERVER";
	const SESSION_LIFETIME = "SESSION_LIFETIME";
	const SESSION_NAME = "SESSION_NAME";

	private const _DEFAULTS = [
		Config::DB_TYPE => [ "sqlite", Config::T_STRING ],
		Config::SCRATCH_DB => [ "db/scratch.db", Config::T_STRING ],
		Config::CALIBRE_DB => [ "", Config::T_STRING ],
		Config::BOOKS_DIR => [ "", Config::T_STRING ],
		Config::DICT_SERVER => [ "", Config::T_STRING ],
		Config::SESSION_LIFETIME => [ 86400*30, Config::T_INT ],
		Config::SESSION_NAME => [ "epube_sid", Config::T_STRING ],
	];

	private static $instance;

	private $params = [];
	private $schema_version = null;
	private $version = [];

	/** @var Db_Migrations $migrations */
	private $migrations;

	public static function get_instance() : Config {
		if (self::$instance == null)
			self::$instance = new self();

		return self::$instance;
	}

	private function __clone() {
		//
	}

	function __construct() {
		$ref = new ReflectionClass(get_class($this));

		foreach ($ref->getConstants() as $const => $cvalue) {
			if (isset($this::_DEFAULTS[$const])) {
				$override = getenv($this::_ENVVAR_PREFIX . $const);

				list ($defval, $deftype) = $this::_DEFAULTS[$const];

				$this->params[$cvalue] = [ self::cast_to(!empty($override) ? $override : $defval, $deftype), $deftype ];
			}
		}
	}

	/* package maintainers who don't use git: if version_static.txt exists in tt-rss root
		directory, its contents are displayed instead of git commit-based version, this could be generated
		based on source git tree commit used when creating the package */

	static function get_version(bool $as_string = true) {
		return self::get_instance()->_get_version($as_string);
	}

	private function _get_version(bool $as_string = true) {
		$root_dir = dirname(__DIR__);

		if (empty($this->version)) {
			$this->version["status"] = -1;

			if (PHP_OS === "Darwin") {
				$ttrss_version["version"] = "UNKNOWN (Unsupported, Darwin)";
			} else if (file_exists("$root_dir/version_static.txt")) {
				$this->version["version"] = trim(file_get_contents("$root_dir/version_static.txt")) . " (Unsupported)";
			} else if (is_dir("$root_dir/.git")) {
				$this->version = self::get_version_from_git($root_dir);

				if ($this->version["status"] != 0) {
					user_error("Unable to determine version: " . $this->version["version"], E_USER_WARNING);

					$this->version["version"] = "UNKNOWN (Unsupported, Git error)";
				}
			} else {
				$this->version["version"] = "UNKNOWN (Unsupported)";
			}
		}

		return $as_string ? $this->version["version"] : $this->version;
	}

	static function get_version_from_git(string $dir) {
		$descriptorspec = [
			1 => ["pipe", "w"], // STDOUT
			2 => ["pipe", "w"], // STDERR
		];

		$rv = [
			"status" => -1,
			"version" => "",
			"commit" => "",
			"timestamp" => 0,
		];

		$proc = proc_open("git --no-pager log --pretty=\"version-%ct-%h\" -n1 HEAD",
						$descriptorspec, $pipes, $dir);

		if (is_resource($proc)) {
			$stdout = trim(stream_get_contents($pipes[1]));
			$stderr = trim(stream_get_contents($pipes[2]));
			$status = proc_close($proc);

			$rv["status"] = $status;

			list($check, $timestamp, $commit) = explode("-", $stdout);

			if ($check == "version") {

				$rv["version"] = strftime("%y.%m", (int)$timestamp) . "-$commit";
				$rv["commit"] = $commit;
				$rv["timestamp"] = $timestamp;

				// proc_close() may return -1 even if command completed successfully
				// so if it looks like we got valid data, we ignore it

				if ($rv["status"] == -1)
					$rv["status"] = 0;

			} else {
				$rv["version"] = T_sprintf("Git error [RC=%d]: %s", $status, $stderr);
			}
		}

		return $rv;
	}

	static function get_migrations() : Db_Migrations {
		return self::get_instance()->_get_migrations();
	}

	private function _get_migrations() : Db_Migrations {
		if (empty($this->migrations)) {
			$this->migrations = new Db_Migrations();
			$this->migrations->initialize(dirname(__DIR__) . "/sql", "epube_migrations", true);
		}

		return $this->migrations;
	}

	static function is_migration_needed() : bool {
		return self::get_migrations()->is_migration_needed();
	}

	static function get_schema_version() : int {
		return self::get_migrations()->get_version();
	}

	static function cast_to(string $value, int $type_hint) {
		switch ($type_hint) {
			case self::T_BOOL:
				return sql_bool_to_bool($value);
			case self::T_INT:
				return (int) $value;
			default:
				return $value;
		}
	}

	private function _get(string $param) {
		list ($value, $type_hint) = $this->params[$param];

		return $this->cast_to($value, $type_hint);
	}

	private function _add(string $param, string $default, int $type_hint) {
		$override = getenv($this::_ENVVAR_PREFIX . $param);

		$this->params[$param] = [ self::cast_to(!empty($override) ? $override : $default, $type_hint), $type_hint ];
	}

	static function add(string $param, string $default, int $type_hint = Config::T_STRING) {
		$instance = self::get_instance();

		return $instance->_add($param, $default, $type_hint);
	}

	static function get(string $param) {
		$instance = self::get_instance();

		return $instance->_get($param);
	}

	static function is_server_https() : bool {
		return (!empty($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] != 'off')) ||
			(!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] == 'https');
	}

	/** generates reference self_url_path (no trailing slash) */
	static function make_self_url() : string {
		$proto = self::is_server_https() ? 'https' : 'http';
		$self_url_path = $proto . '://' . $_SERVER["HTTP_HOST"] . $_SERVER["REQUEST_URI"];

		$self_url_path = preg_replace("/\w+\.php(\?.*$)?$/", "", $self_url_path);

		if (substr($self_url_path, -1) === "/") {
			return substr($self_url_path, 0, -1);
		} else {
			return $self_url_path;
		}
	}

	/** also initializes Db and ORM */
	static function sanity_check() {

		/*
			we don't actually need the DB object right now but some checks below might use ORM which won't be initialized
			because it is set up in the Db constructor, which is why it's a good idea to invoke it as early as possible

			it is a bit of a hack, maybe ORM should be initialized somewhere else (functions.php?)
		*/

		$pdo = Db::pdo();

		$errors = [];

		/*if (strpos(self::get(Config::PLUGINS), "auth_") === false) {
			array_push($errors, "Please enable at least one authentication module via PLUGINS");
		}*/

		if (function_exists('posix_getuid') && posix_getuid() == 0) {
			array_push($errors, "Please don't run this script as root.");
		}

		if (version_compare(PHP_VERSION, '7.1.0', '<')) {
			array_push($errors, "PHP version 7.1.0 or newer required. You're using " . PHP_VERSION . ".");
		}

		// TODO: add some relevant stuff

		/*if (!class_exists("UConverter")) {
			array_push($errors, "PHP UConverter class is missing, it's provided by the Internationalization (intl) module.");
		}

		if (!is_writable(self::get(Config::CACHE_DIR) . "/images")) {
			array_push($errors, "Image cache is not writable (chmod -R 777 ".self::get(Config::CACHE_DIR)."/images)");
		}

		if (!is_writable(self::get(Config::CACHE_DIR) . "/upload")) {
			array_push($errors, "Upload cache is not writable (chmod -R 777 ".self::get(Config::CACHE_DIR)."/upload)");
		}

		if (!is_writable(self::get(Config::CACHE_DIR) . "/export")) {
			array_push($errors, "Data export cache is not writable (chmod -R 777 ".self::get(Config::CACHE_DIR)."/export)");
		}

		if (self::get(Config::SINGLE_USER_MODE) && class_exists("PDO")) {
			if (UserHelper::get_login_by_id(1) != "admin") {
				array_push($errors, "SINGLE_USER_MODE is enabled but default admin account (ID: 1) is not found.");
			}
		}*/

		if (php_sapi_name() != "cli") {

			if (self::get_schema_version() < 0) {
				array_push($errors, "Base database schema is missing. Either load it manually or perform a migration (<code>update.php --update-schema</code>)");
			}

/*			$ref_self_url_path = self::make_self_url();

			if ($ref_self_url_path) {
				$ref_self_url_path = preg_replace("/\w+\.php$/", "", $ref_self_url_path);
			}

			if (self::get_self_url() == "http://example.org/tt-rss") {
				$hint = $ref_self_url_path ? "(possible value: <b>$ref_self_url_path</b>)" : "";
				array_push($errors,
						"Please set SELF_URL_PATH to the correct value for your server: $hint");
			}

			if (self::get_self_url() != $ref_self_url_path) {
				array_push($errors,
					"Please set SELF_URL_PATH to the correct value detected for your server: <b>$ref_self_url_path</b> (you're using: <b>" . self::get_self_url() . "</b>)");
			} */
		}

		/* if (!is_writable(self::get(Config::ICONS_DIR))) {
			array_push($errors, "ICONS_DIR defined in config.php is not writable (chmod -R 777 ".self::get(Config::ICONS_DIR).").\n");
		}

		if (!is_writable(self::get(Config::LOCK_DIRECTORY))) {
			array_push($errors, "LOCK_DIRECTORY is not writable (chmod -R 777 ".self::get(Config::LOCK_DIRECTORY).").\n");
		}

		if (!function_exists("curl_init") && !ini_get("allow_url_fopen")) {
			array_push($errors, "PHP configuration option allow_url_fopen is disabled, and CURL functions are not present. Either enable allow_url_fopen or install PHP extension for CURL.");
		}

		if (!function_exists("json_encode")) {
			array_push($errors, "PHP support for JSON is required, but was not found.");
		}

		if (!class_exists("PDO")) {
			array_push($errors, "PHP support for PDO is required but was not found.");
		}

		if (!function_exists("mb_strlen")) {
			array_push($errors, "PHP support for mbstring functions is required but was not found.");
		}

		if (!function_exists("hash")) {
			array_push($errors, "PHP support for hash() function is required but was not found.");
		}

		if (ini_get("safe_mode")) {
			array_push($errors, "PHP safe mode setting is obsolete and not supported by tt-rss.");
		}

		if (!function_exists("mime_content_type")) {
			array_push($errors, "PHP function mime_content_type() is missing, try enabling fileinfo module.");
		}

		if (!class_exists("DOMDocument")) {
			array_push($errors, "PHP support for DOMDocument is required, but was not found.");
		}

		if (self::get(Config::DB_TYPE) == "mysql") {
			$bad_tables = self::check_mysql_tables();

			if (count($bad_tables) > 0) {
				$bad_tables_fmt = [];

				foreach ($bad_tables as $bt) {
					array_push($bad_tables_fmt, sprintf("%s (%s)", $bt['table_name'], $bt['engine']));
				}

				$msg = "<p>The following tables use an unsupported MySQL engine: <b>" .
					implode(", ", $bad_tables_fmt) . "</b>.</p>";

				$msg .= "<p>The only supported engine on MySQL is InnoDB. MyISAM lacks functionality to run
					tt-rss.
					Please backup your data (via OPML) and re-import the schema before continuing.</p>
					<p><b>WARNING: importing the schema would mean LOSS OF ALL YOUR DATA.</b></p>";


				array_push($errors, $msg);
			}
		} */

		if (count($errors) > 0 && php_sapi_name() != "cli") { ?>
			<!DOCTYPE html>
			<html>
				<head>
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<link href="lib/bootstrap/v3/css/bootstrap.min.css" rel="stylesheet" media="screen">
					<link href="lib/bootstrap/v3/css/bootstrap-theme.min.css" rel="stylesheet" media="screen">
					<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
					<script src="dist/app-libs.min.js"></script>
					<title>Startup failed</title>
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
				<body class="epube-sanity-failed">
					<div class="container">
						<h1>Startup failed</h1>

						<p>Please fix errors indicated by the following messages:</p>

						<?php foreach ($errors as $error) { echo self::format_error($error); } ?>

					</div>
				</body>
			</html>

		<?php
			die;
		} else if (count($errors) > 0) {
			echo "Please fix errors indicated by the following messages:\n\n";

			foreach ($errors as $error) {
				echo " * " . strip_tags($error)."\n";
			}

			exit(1);
		}
	}

	private static function format_error($msg) {
		return "<div class=\"alert alert-danger\">$msg</div>";
	}
}

<?php
class Db {
	/** @var Db|null */
	private static $instance;

	private PDO $pdo;

	private function __construct() {
		try {
			$this->pdo = new PDO(self::get_dsn());
		} catch (Exception $e) {
			user_error($e, E_USER_WARNING);
			die("Unable to initialize database driver (SQLite).");
		}
		//$this->dbh->busyTimeout(30*1000);
		$this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		$this->pdo->query('PRAGMA journal_mode = wal');

		try {
			ORM::configure(self::get_dsn());
			ORM::configure('return_result_sets', true);
			ORM::raw_execute('PRAGMA journal_mode = wal');
		} catch (Exception $e) {
			user_error($e, E_USER_WARNING);
			die("Unable to initialize ORM layer.");
		}
	}

	public static function get_dsn() : string {
		return Config::get(Config::DB_TYPE) . ':' . Config::get(Config::SCRATCH_DB);
	}

	public static function pdo() : PDO {
		if (self::$instance == null)
			self::$instance = new self();

		return self::$instance->pdo;
	}

};

?>

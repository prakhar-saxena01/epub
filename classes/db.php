<?php
class Db {
	private static $instance;
	private $pdo;

	private function __construct() {
		try {
			$this->pdo = new PDO(self::get_dsn());
		} catch (Exception $e) {
			die("Unable to initialize database driver (SQLite): $e");
		}
		//$this->dbh->busyTimeout(30*1000);
		$this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
		$this->pdo->query('PRAGMA journal_mode = wal;');

		ORM::configure(self::get_dsn());
		ORM::configure('return_result_sets', true);
	}

	public static function get_dsn() {
		return Config::get(Config::DB_TYPE) . ':' . Config::get(Config::SCRATCH_DB);
	}

	public static function pdo() : PDO {
		if (self::$instance == null)
			self::$instance = new self();

		return self::$instance->pdo;
	}

};

?>

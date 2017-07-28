<?php
class Db {
	private static $instance;
	private $dbh;

	private function __construct() {
		$this->dbh = new SQLite3(SCRATCH_DB);
		$this->dbh->busyTimeout(30*1000);
		$this->dbh->exec('PRAGMA journal_mode = wal;');
	}

	public static function get() {
		if (self::$instance == null)
			self::$instance = new self();

		return self::$instance->dbh;
	}

};

?>

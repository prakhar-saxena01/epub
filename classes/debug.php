<?php
class Debug {
	const LOG_DISABLED = -1;
    const LOG_NORMAL = 0;
    const LOG_VERBOSE = 1;
    const LOG_EXTENDED = 2;

	public static int $LOG_DISABLED = -1;
    public static int $LOG_NORMAL = 0;
    public static int $LOG_VERBOSE = 1;
    public static int $LOG_EXTENDED = 2;

    private static bool $enabled = false;
    private static bool $quiet = false;
    private static string $logfile = "";
    private static int $loglevel = 0;

	public static function set_logfile(string $logfile) : void {
        self::$logfile = $logfile;
    }

    public static function enabled() : bool {
        return self::$enabled;
    }

    public static function set_enabled(bool $enable) : void {
        self::$enabled = $enable;
    }

    public static function set_quiet(bool $quiet) : void {
        self::$quiet = $quiet;
    }

    public static function set_loglevel(int $level) : void {
        self::$loglevel = $level;
    }

    public static function get_loglevel() : int {
        return self::$loglevel;
    }

    public static function log(string $message, int $level = 0) : void {

        if (!self::$enabled || self::$loglevel < $level) return;

        $ts = strftime("%H:%M:%S", time());
        if (function_exists('posix_getpid')) {
            $ts = "$ts/" . posix_getpid();
        }

        if (self::$logfile) {
            $fp = fopen(self::$logfile, 'a+');

            if ($fp) {
                $locked = false;

                if (function_exists("flock")) {
                    $tries = 0;

                    // try to lock logfile for writing
                    while ($tries < 5 && !$locked = flock($fp, LOCK_EX | LOCK_NB)) {
                        sleep(1);
                        ++$tries;
                    }

                    if (!$locked) {
                        fclose($fp);
                        user_error("Unable to lock debugging log file: " . self::$logfile, E_USER_WARNING);
                        return;
                    }
                }

                fputs($fp, "[$ts] $message\n");

                if (function_exists("flock")) {
                    flock($fp, LOCK_UN);
                }

                fclose($fp);

                if (self::$quiet)
                    return;

            } else {
                user_error("Unable to open debugging log file: " . self::$logfile, E_USER_WARNING);
            }
        }

        print "[$ts] $message\n";
    }
}

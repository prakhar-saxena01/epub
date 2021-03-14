The Epube
=========

web EPUB reader using EPUB.js, Bootstrap, and Calibre.

https://git.tt-rss.org/fox/the-epube/wiki

Copyright (c) 2017 Andrew Dolgov (unless explicitly stated otherwise).

Requirements
============

* HTTPS: required for service workers to work
* PDO::sqlite
* Calibre books directory and metadata.db

Host installation
=================

Note: Consider using [docker-compose](https://git.tt-rss.org/fox/epube-docker-compose) instead. Most of the stuff below is handled for you automatically then.

```sh
git clone https://git.tt-rss.org/fox/the-epube.git the-epube
```

**WARNING:** since database folder is, by default, accessible for unauthenticated HTTP requests
it is recommended to set ``SCRATCH_DB`` to a secure random value (i.e. ``db/long-random-string.db``) 
or put it outside of scope accessible by your http server. Alternatively, you can simply block access
to ``db``:

```nginx
location /the-epube/db {
   deny all;
}
```

1. Apply database migrations

```sh
php ./update.php --update-schema
```
    
2. Ensure both <code>scratch.db</code> and its containing folder (i.e. <code>db/</code>) are writable by the 
application, normally this means chown-ing them as <code>www-data</code> or whatever user your httpd is running under.

```sh
chown www-data db/ db/scratch.db
```

3. Set path to Calibre, etc, in `config.php`:

```ini
putenv('EPUBE_BOOKS_DIR=/home/user/calibre/Books');
```

See `classes/config.php` for the list of settings.

4. Setup users via update.php (command line)

```
php ./update.php --help
```

Acknowledgements
================

Normal favicon from Silk icon pack - http://www.famfamfam.com/lab/icons/silk/

License
=======

GNU GPL version 3.

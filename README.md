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

Installation
============

Always use latest Git code from master branch. Ignore the releases page, it doesn't mean anything.

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

1. Initialize scratch.db 

```sh
sqlite3 db/scratch.db < schema.sql
```
    
2. Ensure both <code>scratch.db</code> and its containing folder (i.e. <code>db/</code>) are writable by the 
application, normally this means chown-ing them as <code>www-data</code> or whatever user your httpd is running under.

```sh
chown www-data db/ db/scratch.db
```

3. Copy <code>config.php-dist</code> to <code>config.php</code> and edit path to Calibre, etc.

4. Setup users via useradm.php (command line)

Upgrading
=========

When upgrading from an older Git snapshot which used HTTP Authentication:

1. Disable HTTP Authentication in httpd configuration
2. Reopen browser to clear HTTP auth 
3. Add two new tables to scratch.db (epube_users & epube_sessions)
4. Add users via useradm.php (use same names as http auth, all data will be kept)

Acknowledgements
================

Normal favicon from Silk icon pack - http://www.famfamfam.com/lab/icons/silk/

License
=======

GNU GPL version 3.


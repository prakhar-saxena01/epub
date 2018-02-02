The Epube
=========

web EPUB reader using EPUB.js, Bootstrap, and Calibre.

* responsive design
* has transparent offline mode via service workers
* can optionally store files locally for later reading
* supports word definition lookups using dictd
* supports Chrome homescreen "app mode"
* has several color themes

Screenshots
===========

1. https://tt-rss.org/images/epube/screen1.png (desktop)
2. https://tt-rss.org/images/epube/screen2.png (mobile)
3. https://tt-rss.org/images/epube/screen3.png (settings)

Installation
============

1. Initialize scratch.db 

    <pre>sqlite3 db/scratch.db &lt; schema.sql</pre>
    
2. Ensure both <code>scratch.db</code> and its containing folder (i.e. <code>db/</code>) are writable by the 
application, normally this means chown-ing them as <code>www-data</code> or whatever user your httpd is running under.

    <pre>chown www-data db/ db/sratch.db</pre>

3. Copy <code>config.php-dist</code> to <code>config.php</code> and edit path to Calibre, etc.

4. Setup users via useradm.php (command line)

Upgrading
=========

When upgrading from an older Git snapshot which used HTTP Authentication:

1. Disable HTTP Authentication in httpd configuration
2. Reopen browser to clear HTTP auth 
3. Add two new tables to scratch.db (epube_users & epube_sessions)
4. Add users via useradm.php (use same names as http auth, all data will be kept)

Requirements
============

* PDO::sqlite
* Calibre books directory and metadata.db

Acknowledgements
================

1. Hires favicon by Flaticon - https://www.shareicon.net/business-school-material-open-book-education-leisure-reader-reading-794233
2. Normal favicon from Silk icon pack - http://www.famfamfam.com/lab/icons/silk/

License
=======

GNU GPL version 3.

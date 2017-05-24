The Epube
=========

web EPUB reader using EPUB.js, Bootstrap, and Calibre.

* responsive design
* relies on HTTP Authentication provided by httpd
* has transparent offline mode via service workers
* can optionally store files locally for later reading
* supports word definition lookups using dictd
* supports Chrome homescreen "app mode"

Installation
============

1. Initialize scratch.db 

    <pre>sqlite3 db/scratch.db &lt; schema.sql</pre>
    
2. Ensure both <code>scratch.db</code> and its containing folder (i.e. <code>db/</code>) are writable by the 
application, normally this means chown-ing them as <code>www-data</code> or whatever user your httpd is running under.

    <pre>chown www-data db/ db/sratch.db</pre>

3. Copy <code>config.php-dist</code> to <code>config.php</code> and edit path to Calibre, etc.

4. Setup HTTP Basic authentication for epube directories. This is required, even if you're the only user.

Requirements
============

* php-sqlite
* Calibre books directory and metadata.db

Acknowledgements
================

1. Hires favicon by Flaticon - https://www.shareicon.net/business-school-material-open-book-education-leisure-reader-reading-794233
2. Normal favicon from Silk icon pack - http://www.famfamfam.com/lab/icons/silk/

License
=======

GNU GPL version 3.
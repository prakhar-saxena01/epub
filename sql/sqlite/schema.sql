create table if not exists epube_pagination (
	id integer not null primary key autoincrement,
	bookid integer not null,
	total_pages integer not null,
	pagination text not null);

create table if not exists epube_books (
	id integer not null primary key autoincrement,
	bookid integer not null,
	owner varchar(200) not null,
	lastts integer not null,
	lastcfi varchar(200) not null,
	lastread integer not null);

create table if not exists epube_users (
	id integer not null primary key autoincrement,
	user varchar(100) not null,
	pass varchar(200) not null);

create table if not exists epube_favorites(
	id integer not null primary key autoincrement,
	bookid integer not null,
	owner varchar(200) not null);

drop table if exists epube_pagination;
drop table if exists epube_books;
drop table if exists epube_users;
drop table if exists epube_sessions;

drop index if exists epube_sessions_expire;

create table epube_pagination(
	id integer not null primary key autoincrement,
	bookid integer not null,
	total_pages integer not null,
	pagination text not null);

create table epube_books(
	id integer not null primary key autoincrement,
	bookid integer not null,
	owner varchar(200) not null,
	lastcfi varchar(200) not null,
	lastread integer not null);

create table epube_users(
	id integer not null primary key autoincrement,
	user varchar(100) not null,
	pass varchar(200) not null);

create table epube_sessions (
	id varchar(250) not null primary key,
	data text,
	expire integer not null);

create table epube_favorites(
	id integer not null primary key autoincrement,
	bookid integer not null,
	owner varchar(200) not null);


create index epube_sessions_expire on epube_sessions(expire);

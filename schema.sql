drop table if exists epube_pagination;
drop table if exists epube_books;

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

drop table if exists epube_settings;
drop table if exists epube_pagination;
drop table if exists epube_books;

create table epube_settings(
	id serial not null primary key,
	owner varchar(200) not null unique,
	font_size integer not null,
	font_family varchar(200) not null,
	line_height integer not null);

create table epube_pagination(
	id serial not null primary key,
	bookid varchar(200) not null,
	pagination text not null);

create table epube_books(
	id serial not null primary key,
	bookid varchar(200) not null,
	owner varchar(200) not null,
	lastread integer not null);

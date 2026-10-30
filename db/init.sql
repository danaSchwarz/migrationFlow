create table countries (
    iso3  char(3) primary key,
    name varchar(255) not null,
    lat float,
    lon float
);

create table flows(
    year0 smallint not null,
    orig char(3) not null references countries(iso3),
    dest char(3) not null references countries(iso3),
    method varchar(255) not null check (method in ('sd_drop_neg', 'sd_rev_neg', 'mig_rate', 'da_min_open', 'da_min_closed', 'da_pb_closed')),
    value int not null,
    source_version varchar(255) not null,
    primary key (source_version, year0, orig, dest, method)
);
-- The demo migration filed used to generate this application from
-- trybase.app

create table users (
  id bigint primary key generated always as identity,
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  created_at timestamp with time zone default now()
);

create table posts (
  id bigint primary key generated always as identity,
  user_id bigint not null references users (id),
  content text not null,
  created_at timestamp with time zone default now()
);

create table likes (
  id bigint primary key generated always as identity,
  user_id bigint not null references users (id),
  post_id bigint not null references posts (id),
  created_at timestamp with time zone default now(),
  unique (user_id, post_id)
);

create table comments (
  id bigint primary key generated always as identity,
  user_id bigint not null references users (id),
  post_id bigint not null references posts (id),
  content text not null,
  created_at timestamp with time zone default now()
);

create table followers (
  id bigint primary key generated always as identity,
  follower_id bigint not null references users (id),
  followee_id bigint not null references users (id),
  created_at timestamp with time zone default now(),
  unique (follower_id, followee_id)
);

create table hashtags (
  id bigint primary key generated always as identity,
  name text unique not null
);
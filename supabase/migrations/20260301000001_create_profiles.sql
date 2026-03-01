-- Create profiles table that extends auth.users
create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text,
  role      text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;

-- Users can read their own profile; admins can read all
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

-- Users can update their own profile (but not role)
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user');

-- Helper function: returns true if the current user is an admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
$$ language sql security definer;

-- Create todos table
create table public.todos (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  text        text not null,
  completed   boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_todos_updated
  before update on public.todos
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.todos enable row level security;

-- SELECT: users see own todos; admins see all
create policy "Select own todos or admin sees all"
  on public.todos for select
  using (user_id = auth.uid() or public.is_admin());

-- INSERT: users can only insert their own todos
create policy "Insert own todos"
  on public.todos for insert
  with check (user_id = auth.uid());

-- UPDATE: users update own todos; admins update any
create policy "Update own todos or admin updates any"
  on public.todos for update
  using (user_id = auth.uid() or public.is_admin());

-- DELETE: users delete own todos; admins delete any
create policy "Delete own todos or admin deletes any"
  on public.todos for delete
  using (user_id = auth.uid() or public.is_admin());

-- Tradent: Portfolios & Trades Tabellen
-- Mit Row Level Security (jeder User sieht nur seine Daten)

-- 1. Portfolios
create table portfolios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  budget numeric not null,
  current_balance numeric not null,
  risk_steady numeric not null default 2,
  risk_bold numeric not null default 5,
  is_active boolean not null default false,
  created_at timestamptz default now() not null
);

alter table portfolios enable row level security;

create policy "Users see own portfolios"
  on portfolios for select
  using (auth.uid() = user_id);

create policy "Users insert own portfolios"
  on portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users update own portfolios"
  on portfolios for update
  using (auth.uid() = user_id);

create policy "Users delete own portfolios"
  on portfolios for delete
  using (auth.uid() = user_id);

-- 2. Trades
create table trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  portfolio_id uuid references portfolios(id) on delete cascade not null,
  signal_id text not null,
  asset text not null,
  direction text not null,
  entry numeric not null,
  stop_loss numeric not null,
  take_profit numeric not null,
  leverage text not null,
  budget numeric not null,
  status text not null default 'open',
  result numeric,
  opened_at timestamptz default now() not null,
  closed_at timestamptz
);

alter table trades enable row level security;

create policy "Users see own trades"
  on trades for select
  using (auth.uid() = user_id);

create policy "Users insert own trades"
  on trades for insert
  with check (auth.uid() = user_id);

create policy "Users update own trades"
  on trades for update
  using (auth.uid() = user_id);

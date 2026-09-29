create table if not exists public.cards(
 code text primary key, card_no text not null, name_ko text not null, rarity text, variant text, finish text not null check(finish in ('NORMAL','FOIL')), image_url text, sell_qty int not null default 0 check(sell_qty>=0), sell_price int not null default 0 check(sell_price>=0), north_america_price int not null default 0, binder_owned boolean not null default false, sort_no numeric default 9999, updated_at timestamptz not null default now());
create table if not exists public.shop_settings(id int primary key default 1 check(id=1),store_name text not null default '리프트바운드 오리진 카드샵',kakao_openchat_url text default '',notice text default '구매 희망 카드를 선택한 뒤 구매목록을 복사하여 카카오톡으로 보내주세요.',updated_at timestamptz not null default now());
insert into public.shop_settings(id) values(1) on conflict(id) do nothing;
alter table public.cards enable row level security; alter table public.shop_settings enable row level security;
create or replace view public.public_cards as select code,card_no,name_ko,rarity,variant,finish,image_url,sell_qty,sell_price,sort_no from public.cards where sell_qty>0 and sell_price>0;
create or replace view public.public_shop_settings as select id,store_name,kakao_openchat_url,notice from public.shop_settings;
grant select on public.public_cards to anon,authenticated; grant select on public.public_shop_settings to anon,authenticated;
revoke all on public.cards from anon; revoke all on public.shop_settings from anon;
create policy "auth read cards" on public.cards for select to authenticated using(true);
create policy "auth insert cards" on public.cards for insert to authenticated with check(true);
create policy "auth update cards" on public.cards for update to authenticated using(true) with check(true);
create policy "auth delete cards" on public.cards for delete to authenticated using(true);
create policy "auth read settings" on public.shop_settings for select to authenticated using(true);
create policy "auth update settings" on public.shop_settings for update to authenticated using(true) with check(true);

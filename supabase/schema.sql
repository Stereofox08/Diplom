-- ByteStore: normalized PostgreSQL storage and authenticated API.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.categories (id text primary key, data jsonb not null);
create table public.products (
 id text primary key, category_id text not null references public.categories(id),
 name text not null check(length(trim(name)) > 0), price bigint not null check(price >= 0),
 stock integer not null check(stock >= 0), status text not null default 'active' check(status in ('active','hidden')),
 data jsonb not null default '{}', revision bigint not null default 1
);
create index products_category_idx on public.products(category_id);
create table public.product_costs (product_id text primary key references public.products(id) on delete cascade, cost bigint not null check(cost >= 0));
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', email text not null, phone text not null default '',
 status text not null default 'active' check(status in ('active','blocked')),
 newsletter boolean not null default false, created_at timestamptz not null default now()
);
create table private.staff (user_id uuid primary key references auth.users(id) on delete cascade);
alter table private.staff enable row level security;
create policy staff_no_client_access on private.staff for all to anon,authenticated using(false) with check(false);
create table public.promos (
 code text primary key, type text not null check(type in ('percent','fixed')),
 value bigint not null check(value > 0 and (type <> 'percent' or value <= 100)),
 min bigint not null default 0 check(min >= 0), active boolean not null default true,
 used bigint not null default 0, description text not null default ''
);
create table public.store_settings (id boolean primary key default true check(id), data jsonb not null);
create table public.ai_settings (id boolean primary key default true check(id), data jsonb not null default '{}');
create table public.orders (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity unique,
 user_id uuid not null references auth.users(id), request_id uuid not null,
 status text not null default 'new' check(status in ('new','processing','shipped','delivered','cancelled')),
 subtotal bigint not null check(subtotal >= 0), discount bigint not null check(discount >= 0),
 delivery_cost bigint not null check(delivery_cost >= 0), total bigint not null check(total >= 0),
 data jsonb not null, created_at timestamptz not null default now(), unique(user_id, request_id)
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create table public.order_items (
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id text not null, name text not null, category_id text not null,
 qty integer not null check(qty > 0), price bigint not null check(price >= 0),
 primary key(order_id, product_id)
);
create index order_items_product_idx on public.order_items(product_id);
create table public.reviews (
 id uuid primary key default gen_random_uuid(), product_id text not null references public.products(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null, author text not null,
 rating integer not null check(rating between 1 and 5), text text not null check(length(text) >= 10),
 status text not null default 'pending' check(status in ('pending','published','rejected')),
 data jsonb not null default '{}', created_at timestamptz not null default now(), unique(product_id,user_id)
);
create index reviews_user_idx on public.reviews(user_id);
create index reviews_product_status_idx on public.reviews(product_id,status);
create table public.review_likes (
 review_id uuid not null references public.reviews(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, primary key(review_id,user_id)
);
create index review_likes_user_idx on public.review_likes(user_id);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
 action text not null, created_at timestamptz not null default now()
);
create index audit_log_user_idx on public.audit_log(user_id);
create index audit_log_created_idx on public.audit_log(created_at desc);

create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from private.staff s join public.profiles p on p.id=s.user_id where s.user_id=auth.uid() and p.status='active');
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,name,email,phone) values(new.id,coalesce(new.raw_user_meta_data->>'name',''),new.email,coalesce(new.raw_user_meta_data->>'phone',''));
 return new;
end; $$;
revoke all on function private.new_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_profile();

-- Every exposed table has RLS. Clients can read only their allowed rows.
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.profiles enable row level security;
alter table public.promos enable row level security;
alter table public.store_settings enable row level security;
alter table public.ai_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.review_likes enable row level security;
alter table public.audit_log enable row level security;
create policy categories_read on public.categories for select to anon,authenticated using(true);
create policy products_read on public.products for select to anon,authenticated using(status='active' or (select private.is_admin()));
create policy costs_read on public.product_costs for select to anon,authenticated using((select private.is_admin()));
create policy profiles_read on public.profiles for select to anon,authenticated using(id=(select auth.uid()) or (select private.is_admin()));
create policy promos_read on public.promos for select to anon,authenticated using(active or (select private.is_admin()));
create policy settings_read on public.store_settings for select to anon,authenticated using(true);
create policy ai_read on public.ai_settings for select to anon,authenticated using((select private.is_admin()));
create policy orders_read on public.orders for select to anon,authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy items_read on public.order_items for select to anon,authenticated using(exists(select 1 from public.orders o where o.id=order_id));
create policy reviews_read on public.reviews for select to anon,authenticated using(status='published' or user_id=(select auth.uid()) or (select private.is_admin()));
create policy likes_read on public.review_likes for select to anon,authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
create policy audit_read on public.audit_log for select to anon,authenticated using((select private.is_admin()));
revoke all on public.categories,public.products,public.product_costs,public.profiles,public.promos,public.store_settings,public.ai_settings,public.orders,public.order_items,public.reviews,public.review_likes,public.audit_log from anon,authenticated;
grant select on public.categories,public.products,public.product_costs,public.profiles,public.promos,public.store_settings,public.ai_settings,public.orders,public.order_items,public.reviews,public.review_likes,public.audit_log to anon,authenticated;

create function public.store_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'version',2, 'isAdmin',private.is_admin(),
 'categories',coalesce((select jsonb_agg(c.data || jsonb_build_object('id',c.id)) from public.categories c),'[]'),
 'products',coalesce((select jsonb_agg((p.data - 'cost') || jsonb_build_object('id',p.id,'categoryId',p.category_id,'name',p.name,'price',p.price,'stock',p.stock,'status',p.status,'revision',p.revision,'cost',coalesce(c.cost,0),'rating',coalesce((select round(avg(r.rating),1) from public.reviews r where r.product_id=p.id and r.status='published'),0),'reviews',(select count(*) from public.reviews r where r.product_id=p.id and r.status='published'))) from public.products p left join public.product_costs c on c.product_id=p.id),'[]'),
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'phone',p.phone,'status',p.status,'newsletter',p.newsletter,'bonus',0,'role','user','createdAt',extract(epoch from p.created_at)*1000)) from public.profiles p),'[]'),
 'orders',coalesce((select jsonb_agg(o.data || jsonb_build_object('id',o.id,'number','BS-'||o.number,'userId',o.user_id,'status',o.status,'subtotal',o.subtotal,'discount',o.discount,'deliveryCost',o.delivery_cost,'total',o.total,'createdAt',extract(epoch from o.created_at)*1000,'items',coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'categoryId',i.category_id,'price',i.price,'qty',i.qty)) from public.order_items i where i.order_id=o.id),'[]')) order by o.created_at desc) from public.orders o),'[]'),
 'reviews',coalesce((select jsonb_agg(r.data || jsonb_build_object('id',r.id,'productId',r.product_id,'productName',p.name,'categoryId',p.category_id,'userId',r.user_id,'author',r.author,'rating',r.rating,'text',r.text,'status',r.status,'likes',coalesce((r.data->>'likes')::integer,0),'verified',false,'createdAt',extract(epoch from r.created_at)*1000)) from public.reviews r join public.products p on p.id=r.product_id),'[]'),
 'promos',coalesce((select jsonb_agg(to_jsonb(p)) from public.promos p),'[]'),
 'settings',coalesce((select s.data from public.store_settings s where s.id),'{}') || jsonb_build_object('ai',coalesce((select a.data from public.ai_settings a where a.id),'{"enabled":true,"apiKey":"","useFallback":true}')),
 'admin',jsonb_build_object('login',coalesce((select p.email from public.profiles p where p.id=auth.uid()),'Admin'),'lastLogin',null),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'user',coalesce(a.user_id::text,'system'),'ts',extract(epoch from a.created_at)*1000) order by a.created_at desc) from (select * from public.audit_log order by created_at desc limit 300) a),'[]'),
 'events','[]'::jsonb,'visits','[]'::jsonb,'carts','{}'::jsonb,'favorites','{}'::jsonb
); $$;
revoke all on function public.store_snapshot() from public;
grant execute on function public.store_snapshot() to anon,authenticated;

-- Privileged work stays in a non-exposed schema and checks identity itself.
create function private.store_command(op text, args jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid(); admin boolean := private.is_admin(); a jsonb := coalesce(args->0,'{}');
 b jsonb := args->1; ident text; row_id uuid; p public.products; rev public.reviews;
 profile public.profiles; old_order public.orders; result jsonb := 'true'; current_rev bigint;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and status='active') then raise exception 'Требуется вход в активную учётную запись' using errcode='42501'; end if;
 select * into profile from public.profiles where id=uid;
 if op='updateProfile' then
   update public.profiles set name=coalesce(nullif(trim(a->>'name'),''),name),phone=coalesce(a->>'phone',phone),newsletter=coalesce((a->>'newsletter')::boolean,newsletter) where id=uid;
   result := jsonb_build_object('ok',true,'message','Профиль сохранён');
 elsif op='addReview' then
   if length(trim(a->>'text'))<10 then raise exception 'Отзыв должен содержать не менее 10 символов'; end if;
   if not exists(select 1 from public.products where id=a->>'productId' and status='active') then raise exception 'Товар не найден'; end if;
   insert into public.reviews(product_id,user_id,author,rating,text,data) values(a->>'productId',uid,profile.name,(a->>'rating')::integer,trim(a->>'text'),jsonb_build_object('pros',coalesce(a->>'pros',''),'cons',coalesce(a->>'cons',''),'reply',''));
   result := jsonb_build_object('ok',true,'message','Отзыв отправлен на модерацию');
 elsif op='likeReview' then
   row_id := (args->>0)::uuid;
   if not exists(select 1 from public.reviews where id=row_id and status='published') then raise exception 'Отзыв не найден'; end if;
   insert into public.review_likes(review_id,user_id) values(row_id,uid) on conflict do nothing;
   if found then update public.reviews set data=jsonb_set(data,'{likes}',to_jsonb(coalesce((data->>'likes')::integer,0)+1)) where id=row_id; end if;
 elsif op='deleteReview' then
   delete from public.reviews where id=(args->>0)::uuid and (user_id=uid or admin);
   if not found then raise exception 'Отзыв не найден или нет доступа'; end if;
 elsif op='setOrderStatus' and not admin then
   select * into old_order from public.orders where id=(args->>0)::uuid and user_id=uid for update;
   if old_order.id is null or old_order.status<>'shipped' or args->>1<>'delivered' then raise exception 'Нельзя изменить статус этого заказа' using errcode='42501'; end if;
   update public.orders set status='delivered', data=jsonb_set(data,'{history}',coalesce(data->'history','[]') || jsonb_build_array(jsonb_build_object('status','delivered','ts',extract(epoch from now())*1000))) where id=old_order.id;
 else
   if not admin then raise exception 'Требуются права администратора' using errcode='42501'; end if;
   case op
   when 'saveProduct' then
     ident := coalesce(nullif(a->>'id',''),'p-'||gen_random_uuid()::text);
     select revision into current_rev from public.products where id=ident for update;
     if current_rev is not null and coalesce((a->>'revision')::bigint,0)<>current_rev then raise exception 'Товар изменился. Обновите данные и повторите сохранение.' using errcode='PT409'; end if;
     insert into public.products(id,category_id,name,price,stock,status,data) values(ident,a->>'categoryId',trim(a->>'name'),(a->>'price')::bigint,(a->>'stock')::integer,coalesce(a->>'status','active'),a - array['cost','id','categoryId','name','price','stock','status','revision'])
     on conflict(id) do update set category_id=excluded.category_id,name=excluded.name,price=excluded.price,stock=excluded.stock,status=excluded.status,data=excluded.data,revision=products.revision+1;
     insert into public.product_costs(product_id,cost) values(ident,coalesce((a->>'cost')::bigint,0)) on conflict(product_id) do update set cost=excluded.cost;
     result := jsonb_build_object('ok',true,'message','Товар сохранён');
   when 'updateStock' then
     update public.products set stock=(args->>1)::integer,revision=revision+1 where id=args->>0 and revision=(args->>2)::bigint;
     if not found then raise exception 'Остаток изменился. Обновите данные.' using errcode='PT409'; end if;
   when 'deleteProduct' then delete from public.products where id=args->>0;
   when 'duplicateProduct' then
     select * into p from public.products where id=args->>0;
     ident := p.id||'-copy-'||substr(gen_random_uuid()::text,1,6);
     insert into public.products(id,category_id,name,price,stock,status,data) values(ident,p.category_id,p.name||' (копия)',p.price,p.stock,'hidden',p.data||jsonb_build_object('sales',0,'views',0,'createdAt',extract(epoch from now())*1000));
     insert into public.product_costs select ident,cost from public.product_costs where product_id=p.id;
     result := jsonb_build_object('id',ident,'name',p.name||' (копия)');
   when 'saveCategory' then
     ident := coalesce(nullif(a->>'id',''),'category-'||substr(gen_random_uuid()::text,1,8));
     insert into public.categories(id,data) values(ident,a) on conflict(id) do update set data=excluded.data;
     result := jsonb_build_object('ok',true,'message','Категория сохранена');
   when 'deleteCategory' then delete from public.categories where id=args->>0; result:=jsonb_build_object('ok',true,'message','Категория удалена');
   when 'savePromo' then
     insert into public.promos(code,type,value,min,active,description) values(upper(trim(a->>'code')),a->>'type',(a->>'value')::bigint,coalesce((a->>'min')::bigint,0),coalesce((a->>'active')::boolean,true),coalesce(a->>'description','')) on conflict(code) do update set type=excluded.type,value=excluded.value,min=excluded.min,active=excluded.active,description=excluded.description;
     result:=jsonb_build_object('ok',true,'message','Промокод сохранён');
   when 'deletePromo' then delete from public.promos where code=args->>0;
   when 'setUserStatus' then
     if (args->>0)::uuid=uid then raise exception 'Нельзя заблокировать собственную учётную запись'; end if;
     update public.profiles set status=args->>1 where id=(args->>0)::uuid;
   when 'deleteUser' then raise exception 'Удаление учётных записей выполняется через Supabase Auth. Используйте блокировку.';
   when 'deleteOrder' then raise exception 'Заказы сохраняются для истории. Используйте отмену заказа.';
   when 'setOrderStatus' then
     select * into old_order from public.orders where id=(args->>0)::uuid for update;
     if old_order.id is null then raise exception 'Заказ не найден'; end if;
     if args->>1 not in ('new','processing','shipped','delivered','cancelled') then raise exception 'Некорректный статус'; end if;
     if old_order.status='cancelled' and args->>1<>'cancelled' then raise exception 'Отменённый заказ нельзя восстановить'; end if;
     if old_order.status='delivered' and args->>1<>'delivered' then raise exception 'Полученный заказ нельзя изменить'; end if;
     if args->>1='cancelled' and old_order.status<>'cancelled' then
       update public.products restored set stock=restored.stock+i.qty,revision=restored.revision+1,data=jsonb_set(restored.data,'{sales}',to_jsonb(greatest(0,coalesce((restored.data->>'sales')::bigint,0)-i.qty))) from public.order_items i where i.order_id=old_order.id and i.product_id=restored.id;
     end if;
     update public.orders set status=args->>1,data=jsonb_set(data,'{history}',coalesce(data->'history','[]') || jsonb_build_array(jsonb_build_object('status',args->>1,'ts',extract(epoch from now())*1000,'comment',coalesce(args->>2,'')))) where id=old_order.id;
   when 'updateOrderComment' then update public.orders set data=jsonb_set(data,'{managerComment}',to_jsonb(coalesce(args->>1,''))) where id=(args->>0)::uuid;
   when 'setReviewStatus' then update public.reviews set status=args->>1 where id=(args->>0)::uuid;
   when 'replyReview' then update public.reviews set data=data || jsonb_build_object('reply',args->>1,'replyAt',extract(epoch from now())*1000) where id=(args->>0)::uuid;
   when 'updateReview' then update public.reviews set rating=coalesce((b->>'rating')::integer,rating),text=coalesce(b->>'text',text),data=data||jsonb_build_object('reply',coalesce(b->>'reply',data->>'reply','')) where id=(args->>0)::uuid;
   when 'updateSettings' then update public.store_settings set data=data||(a-'ai') where id;
   when 'updateAiSettings' then insert into public.ai_settings(id,data) values(true,a) on conflict(id) do update set data=ai_settings.data||excluded.data;
   else raise exception 'Неизвестная операция';
   end case;
 end if;
 insert into public.audit_log(user_id,action) values(uid,op);
 return result;
end; $$;
revoke all on function private.store_command(text,jsonb) from public;
grant execute on function private.store_command(text,jsonb) to authenticated;
create function public.store_command(op text, args jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.store_command(op,args); $$;
revoke all on function public.store_command(text,jsonb) from public;
grant execute on function public.store_command(text,jsonb) to authenticated;

create function private.checkout(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); request uuid:=(payload->>'requestId')::uuid; oid uuid; existing public.orders;
 line record; p public.products; settings jsonb; promo public.promos;
 subtotal bigint:=0; discount bigint:=0; delivery bigint; total bigint; item_count integer;
 payment text:=coalesce(nullif(payload->>'payment',''),'Оплата при получении');
 payment_status text;
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and status='active') then raise exception 'Войдите в аккаунт для оформления заказа' using errcode='42501'; end if;
 if request is null then raise exception 'Не указан идентификатор заказа'; end if;
 -- Per-request lock makes retries idempotent, including simultaneous requests.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||request::text,0));
 select * into existing from public.orders where user_id=uid and request_id=request;
 if existing.id is not null then return jsonb_build_object('ok',true,'orderId',existing.id,'message','Заказ уже оформлен'); end if;
 if jsonb_typeof(payload->'lines')<>'array' or jsonb_array_length(payload->'lines') not between 1 and 100 then raise exception 'Корзина пуста или содержит слишком много позиций'; end if;
 if length(trim(coalesce(payload#>>'{customer,name}','')))<2 or length(regexp_replace(coalesce(payload#>>'{customer,phone}',''),'\D','','g'))<10 then raise exception 'Укажите имя и телефон получателя'; end if;
 if exists(select 1 from jsonb_array_elements(payload->'lines') x where (x->>'qty')::integer not between 1 and 1000) then raise exception 'Некорректное количество'; end if;
 select data into settings from public.store_settings where id;
 -- Sorted row locks prevent overselling and avoid deadlocks between checkouts.
 for line in select x->>'productId' id,sum((x->>'qty')::integer)::integer qty from jsonb_array_elements(payload->'lines') x group by 1 order by 1 loop
   select * into p from public.products where id=line.id for update;
   if p.id is null or p.status<>'active' or line.qty>p.stock or line.qty>1000 then raise exception 'Товар отсутствует или недостаточно остатка: %',line.id; end if;
   subtotal:=subtotal+p.price*line.qty;
 end loop;
 -- The diploma shop simulates payment; no card details enter the API.
 if payment not in ('Картой онлайн','Единый QR','При получении','Оплата при получении') and payment !~ '^Рассрочка 0-0-(6|12|24) · (Halyk|Kaspi|BCC|Freedom)$' then raise exception 'Выберите доступный способ оплаты'; end if;
 payment_status:=case when payment in ('При получении','Оплата при получении') then 'unpaid' else 'paid' end;
 if nullif(trim(payload->>'promoCode'),'') is not null then
   select * into promo from public.promos where code=upper(trim(payload->>'promoCode')) and active for update;
   if promo.code is null or subtotal<promo.min then raise exception 'Промокод недействителен или не достигнута минимальная сумма'; end if;
   discount:=least(subtotal,case when promo.type='percent' then round(subtotal*promo.value/100.0)::bigint else promo.value end);
 end if;
 delivery:=case when subtotal-discount>=coalesce((settings->>'freeDeliveryFrom')::bigint,250000) then 0 else coalesce((settings->>'deliveryCost')::bigint,2990) end;
 total:=subtotal-discount+delivery;
 if (payload->>'expectedTotal')::bigint is distinct from total then raise exception 'Стоимость заказа изменилась. Обновите корзину.' using errcode='PT409'; end if;
 insert into public.orders(user_id,request_id,subtotal,discount,delivery_cost,total,data) values(uid,request,subtotal,discount,delivery,total,jsonb_build_object('customer',payload->'customer','city',coalesce(payload->>'city',''),'address',coalesce(payload->>'address',''),'deliveryType',coalesce(payload->>'deliveryType',''),'payment',payment,'paymentStatus',payment_status,'paymentMode','demo','comment',coalesce(payload->>'comment',''),'source','Каталог','promoCode',coalesce(promo.code,''),'history',jsonb_build_array(jsonb_build_object('status','new','ts',extract(epoch from now())*1000)))) returning id into oid;
 for line in select x->>'productId' id,sum((x->>'qty')::integer)::integer qty from jsonb_array_elements(payload->'lines') x group by 1 order by 1 loop
   select * into p from public.products where id=line.id;
   insert into public.order_items(order_id,product_id,name,category_id,qty,price) values(oid,p.id,p.name,p.category_id,line.qty,p.price);
   update public.products set stock=stock-line.qty,revision=revision+1,data=jsonb_set(data,'{sales}',to_jsonb(coalesce((data->>'sales')::bigint,0)+line.qty)) where id=p.id;
 end loop;
 if promo.code is not null then update public.promos set used=used+1 where code=promo.code; end if;
 insert into public.audit_log(user_id,action) values(uid,'Создан заказ '||oid);
 return jsonb_build_object('ok',true,'orderId',oid,'message','Заказ оформлен.');
end; $$;
revoke all on function private.checkout(jsonb) from public;
grant execute on function private.checkout(jsonb) to authenticated;
create function public.checkout(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.checkout(payload); $$;
revoke all on function public.checkout(jsonb) from public;
grant execute on function public.checkout(jsonb) to authenticated;

insert into public.store_settings(id,data) values(true,'{"siteName":"ByteStore","currency":"₸","deliveryCost":2990,"freeDeliveryFrom":250000,"theme":"dark","recommendations":true,"maintenance":false}');
insert into public.ai_settings(id,data) values(true,'{"enabled":true,"apiKey":"","model":"","useFallback":true}');

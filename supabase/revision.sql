create table public.store_revision(id boolean primary key default true check(id),version bigint not null default 1);
insert into public.store_revision(id) values(true);
alter table public.store_revision enable row level security;
create policy revision_read on public.store_revision for select to anon,authenticated using(true);
revoke all on public.store_revision from anon,authenticated;
grant select on public.store_revision to anon,authenticated;
create function private.bump_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.store_revision set version=version+1 where id; return null; end; $$;
revoke all on function private.bump_revision() from public;
create trigger products_changed after insert or update or delete on public.products for each statement execute function private.bump_revision();
create trigger categories_changed after insert or update or delete on public.categories for each statement execute function private.bump_revision();
create trigger orders_changed after insert or update or delete on public.orders for each statement execute function private.bump_revision();
create trigger reviews_changed after insert or update or delete on public.reviews for each statement execute function private.bump_revision();
create trigger promos_changed after insert or update or delete on public.promos for each statement execute function private.bump_revision();
create trigger settings_changed after insert or update on public.store_settings for each statement execute function private.bump_revision();
create trigger profiles_changed after insert or update or delete on public.profiles for each statement execute function private.bump_revision();
create or replace function public.store_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
 'version',2, 'cloudRevision',(select version from public.store_revision where id), 'isAdmin',private.is_admin(),
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

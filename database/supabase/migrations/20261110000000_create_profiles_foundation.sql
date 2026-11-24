-- Prepared only: review and test against an authorized development target before use.
-- Requires Supabase auth.users, auth.uid(), auth.jwt(), and its standard API roles.
-- Apply as the trusted migration owner; never through an application client.
-- CLI 3.1.0 batches these statements and the history insert in one transaction.
-- Do not add BEGIN/COMMIT: authored boundaries commit before the history insert.

-- Intentionally fail on conflicting objects instead of adopting an unknown schema.
create schema nexus_private;
revoke all on schema nexus_private from public, anon, authenticated, service_role;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_display_name_length check (
        display_name is null or (
            char_length(display_name) between 1 and 120
            and char_length(btrim(display_name)) > 0
        )
    ),
    constraint profiles_timestamp_order check (updated_at >= created_at)
);

alter table public.profiles enable row level security;

-- Override permissive managed-schema default grants for this new table only.
revoke all on table public.profiles from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create policy profiles_select_own on public.profiles
    for select to authenticated
    using (
        id = (select auth.uid())
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
    );

create policy profiles_update_own on public.profiles
    for update to authenticated
    using (
        id = (select auth.uid())
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
    )
    with check (
        id = (select auth.uid())
        and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
    );

-- Invoker privileges suffice: this trigger changes NEW, not another table.
create function nexus_private.protect_profile_system_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    if new.id is distinct from old.id
        or new.created_at is distinct from old.created_at
        or new.updated_at is distinct from old.updated_at then
        raise exception 'Profile system fields cannot be modified'
            using errcode = '42501';
    end if;

    new.updated_at := statement_timestamp();
    return new;
end;
$function$;

revoke all on function nexus_private.protect_profile_system_fields()
    from public, anon, authenticated, service_role;

create trigger profiles_protect_system_fields
    before update on public.profiles
    for each row execute function nexus_private.protect_profile_system_fields();

-- Only the signup trigger uses elevated privileges. Copy no untrusted user metadata.
-- Leave failures visible: a profile failure must roll back the Auth insert as well.
create function nexus_private.provision_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
    insert into public.profiles (id) values (new.id);
    return new;
end;
$function$;

revoke all on function nexus_private.provision_auth_profile()
    from public, anon, authenticated, service_role;

create trigger nexus_auth_user_created_profile
    after insert on auth.users
    for each row execute function nexus_private.provision_auth_profile();

-- Support Auth accounts that predate this first application migration.
-- The migration creates a new table; it never overwrites existing profile content.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

comment on table public.profiles is
    'Private application profiles. Auth owns identity; clients may edit only their display name.';
comment on column public.profiles.id is
    'Same UUID as auth.users.id; provisioned by a private trigger, never client assigned.';

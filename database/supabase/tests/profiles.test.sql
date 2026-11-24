-- FUTURE CONNECTED TEST ONLY. Requires the migration and an EMPTY disposable target.
-- Run with psql -X -v ON_ERROR_STOP=1 -v profiles_test_target=nexus-profiles-disposable.
-- This acknowledgement is NOT target verification. Never use production credentials.
\set ON_ERROR_STOP on
\if :{?profiles_test_target}
    select :'profiles_test_target' = 'nexus-profiles-disposable' as profiles_test_target_ok \gset
    \if :profiles_test_target_ok
    \else
        do $guard$
        begin
            raise exception 'Refusing test: explicitly acknowledge nexus-profiles-disposable';
        end;
        $guard$;
    \endif
\else
    do $guard$
    begin
        raise exception 'Refusing test: profiles_test_target is required';
    end;
    $guard$;
\endif

begin;

set local lock_timeout = '3s';
set local statement_timeout = '30s';
set local idle_in_transaction_session_timeout = '60s';

-- Prevent writes between the empty-target check and fixture cleanup.
-- A busy target fails quickly; do not run this locking test in a shared environment.
lock table auth.users, public.profiles in share row exclusive mode;

-- No pgTAP dependency. Failures raise exceptions; all fixtures roll back.
do $test$
begin
    if current_user <> 'postgres' then
        raise exception 'Run this test as the authorized disposable-target postgres owner';
    end if;
    if exists (select 1 from auth.users) or exists (select 1 from public.profiles) then
        raise exception 'Refusing nonempty target: use a disposable database with no users or profiles';
    end if;
    if exists (select 1 from pg_roles
        where rolname in ('anon', 'authenticated') and (rolsuper or rolbypassrls)) then
        raise exception 'API roles must not be superusers or bypass RLS';
    end if;
    if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
        raise exception 'Profiles RLS is not enabled';
    end if;
    if not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
        or has_table_privilege('authenticated', 'public.profiles', 'INSERT')
        or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
        or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
        or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
        or has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
        or has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
        or has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE') then
        raise exception 'Unexpected authenticated grants';
    end if;
    if has_table_privilege('anon', 'public.profiles', 'SELECT')
        or has_table_privilege('service_role', 'public.profiles', 'SELECT')
        or has_schema_privilege('authenticated', 'nexus_private', 'USAGE')
        or has_schema_privilege('anon', 'nexus_private', 'USAGE')
        or has_schema_privilege('service_role', 'nexus_private', 'USAGE')
        or has_function_privilege('authenticated', 'nexus_private.provision_auth_profile()', 'EXECUTE')
        or has_function_privilege('anon', 'nexus_private.provision_auth_profile()', 'EXECUTE')
        or has_function_privilege('service_role', 'nexus_private.provision_auth_profile()', 'EXECUTE') then
        raise exception 'Unexpected public or privileged application access';
    end if;
    if not exists (
        select 1 from pg_proc
        where oid = 'nexus_private.provision_auth_profile()'::regprocedure
            and prosecdef
            and proowner = (select relowner from pg_class where oid = 'public.profiles'::regclass)
            and proconfig @> array['search_path=""']::text[]
    ) then
        raise exception 'Provisioning function owner, definer, or search_path is unsafe';
    end if;
    if not exists (
        select 1 from pg_proc
        where oid = 'nexus_private.protect_profile_system_fields()'::regprocedure
            and not prosecdef
            and proconfig @> array['search_path=""']::text[]
    ) then
        raise exception 'System-field trigger must remain invoker with a safe search_path';
    end if;
end;
$test$;

insert into auth.users (id, email, raw_user_meta_data) values
    ('10000000-0000-4000-8000-000000000001', 'profiles-a@example.invalid',
        '{"display_name":"Untrusted metadata","role":"admin"}'::jsonb),
    ('10000000-0000-4000-8000-000000000002', 'profiles-b@example.invalid', '{}'::jsonb);

do $test$
begin
    if (select count(*) from public.profiles where id in (
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002'
    )) <> 2 then
        raise exception 'Auth signup did not provision both profiles';
    end if;
    if exists (select 1 from public.profiles
        where id = '10000000-0000-4000-8000-000000000001' and display_name is not null) then
        raise exception 'Untrusted signup metadata was copied';
    end if;
end;
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

do $test$
declare
    affected integer;
    original_created_at timestamptz;
    failed_constraint text;
begin
    if current_user <> 'authenticated'
        or auth.uid() is distinct from '10000000-0000-4000-8000-000000000001'::uuid
        or auth.jwt() ->> 'role' is distinct from 'authenticated'
        or auth.jwt() ->> 'is_anonymous' is distinct from 'false' then
        raise exception 'User A simulated Auth context is incorrect';
    end if;
    if (select count(*) from public.profiles) <> 1
        or not exists (select 1 from public.profiles where id = auth.uid()) then
        raise exception 'User A must read exactly their own profile';
    end if;
    if exists (select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000002') then
        raise exception 'User A can read user B';
    end if;

    select created_at into original_created_at from public.profiles where id = auth.uid();
    update public.profiles set display_name = 'User A' where id = auth.uid();
    get diagnostics affected = row_count;
    if affected <> 1 or not exists (
        select 1 from public.profiles where id = auth.uid()
            and display_name = 'User A'
            and created_at = original_created_at
            and updated_at = statement_timestamp()
    ) then
        raise exception 'Owner update or server timestamp failed';
    end if;

    update public.profiles set display_name = 'Forbidden' where id = '10000000-0000-4000-8000-000000000002';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'User A updated user B'; end if;

    begin
        insert into public.profiles (id) values (auth.uid());
        raise exception 'Client profile insertion unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000002');
        raise exception 'User A inserted a profile under user B ownership';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set id = '10000000-0000-4000-8000-000000000002' where id = auth.uid();
        raise exception 'Owner ID update unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set created_at = now() + interval '1 day' where id = auth.uid();
        raise exception 'created_at update unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set updated_at = now() + interval '1 day' where id = auth.uid();
        raise exception 'updated_at update unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        delete from public.profiles where id = auth.uid();
        raise exception 'Client profile deletion unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;

    begin
        update public.profiles set display_name = '' where id = auth.uid();
        raise exception 'Empty display name unexpectedly succeeded';
    exception when check_violation then
        get stacked diagnostics failed_constraint = constraint_name;
        if failed_constraint <> 'profiles_display_name_length' then raise; end if;
    end;
    begin
        update public.profiles set display_name = '   ' where id = auth.uid();
        raise exception 'Spaces-only display name unexpectedly succeeded';
    exception when check_violation then
        get stacked diagnostics failed_constraint = constraint_name;
        if failed_constraint <> 'profiles_display_name_length' then raise; end if;
    end;
    begin
        update public.profiles set display_name = repeat(' ', 120) || 'x' where id = auth.uid();
        raise exception 'Space-padded oversized display name unexpectedly succeeded';
    exception when check_violation then
        get stacked diagnostics failed_constraint = constraint_name;
        if failed_constraint <> 'profiles_display_name_length' then raise; end if;
    end;
end;
$test$;

-- Exercise the reverse direction, not just User A's view of User B.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);
do $test$
declare affected integer;
begin
    if current_user <> 'authenticated'
        or auth.uid() is distinct from '10000000-0000-4000-8000-000000000002'::uuid
        or auth.jwt() ->> 'role' is distinct from 'authenticated'
        or auth.jwt() ->> 'is_anonymous' is distinct from 'false' then
        raise exception 'User B simulated Auth context is incorrect';
    end if;
    if (select count(*) from public.profiles) <> 1
        or not exists (select 1 from public.profiles where id = auth.uid()) then
        raise exception 'User B must read exactly their own profile';
    end if;
    update public.profiles set display_name = 'User B' where id = auth.uid();
    get diagnostics affected = row_count;
    if affected <> 1 or not exists (
        select 1 from public.profiles where id = auth.uid() and display_name = 'User B'
    ) then raise exception 'User B cannot update their own profile'; end if;
    update public.profiles set display_name = null where id = auth.uid();
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'User B cannot reset their own display name'; end if;
    begin
        insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000001');
        raise exception 'User B inserted a profile under user A ownership';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set id = '10000000-0000-4000-8000-000000000001' where id = auth.uid();
        raise exception 'User B changed their profile owner ID';
    exception when insufficient_privilege then null;
    end;
    update public.profiles set display_name = 'Forbidden'
        where id = '10000000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'User B updated user A'; end if;
end;
$test$;

-- Supabase anonymous sign-ins also use authenticated: deny that JWT explicitly.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',
    '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
do $test$
declare affected integer;
begin
    if exists (select 1 from public.profiles) then
        raise exception 'Anonymous sign-in can read profiles';
    end if;
    update public.profiles set display_name = 'Forbidden' where id = auth.uid();
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous sign-in updated a profile'; end if;
end;
$test$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $test$
begin
    begin
        perform id from public.profiles;
        raise exception 'Unauthenticated SELECT unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set display_name = 'Forbidden';
        raise exception 'Unauthenticated UPDATE unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        delete from public.profiles;
        raise exception 'Unauthenticated DELETE unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000003');
        raise exception 'Unauthenticated INSERT unexpectedly succeeded';
    exception when insufficient_privilege then null;
    end;
end;
$test$;

reset role;

-- A failed profile provision must fail the entire signup, not leave an Auth orphan.
alter table public.profiles add constraint profiles_test_reject_signup
    check (id <> '10000000-0000-4000-8000-000000000003'::uuid);
do $test$
declare failed_constraint text;
begin
    begin
        insert into auth.users (id, email)
        values ('10000000-0000-4000-8000-000000000003', 'profiles-c@example.invalid');
        raise exception 'Signup unexpectedly succeeded despite profile failure';
    exception when check_violation then
        get stacked diagnostics failed_constraint = constraint_name;
        if failed_constraint <> 'profiles_test_reject_signup' then raise; end if;
    end;
    if exists (select 1 from auth.users where id = '10000000-0000-4000-8000-000000000003') then
        raise exception 'Failed profile provisioning left an Auth user behind';
    end if;
end;
$test$;
alter table public.profiles drop constraint profiles_test_reject_signup;

-- The invoker trigger also protects system fields if a broader grant is added later.
do $test$
begin
    begin
        update public.profiles set created_at = now() + interval '1 day'
        where id = '10000000-0000-4000-8000-000000000001';
        raise exception 'System-field trigger allowed a protected update';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set updated_at = now() + interval '1 day'
        where id = '10000000-0000-4000-8000-000000000001';
        raise exception 'System-field trigger allowed an updated_at change';
    exception when insufficient_privilege then null;
    end;
    begin
        update public.profiles set id = '10000000-0000-4000-8000-000000000003'
        where id = '10000000-0000-4000-8000-000000000001';
        raise exception 'System-field trigger allowed an ownership change';
    exception when insufficient_privilege then null;
    end;
end;
$test$;

delete from auth.users where id = '10000000-0000-4000-8000-000000000001';
do $test$
begin
    if exists (select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000001') then
        raise exception 'Auth account deletion did not cascade';
    end if;
    if not exists (select 1 from auth.users where id = '10000000-0000-4000-8000-000000000002')
        or not exists (select 1 from public.profiles
            where id = '10000000-0000-4000-8000-000000000002' and display_name is null) then
        raise exception 'User B was changed or deleted';
    end if;
    begin
        insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000003');
        raise exception 'Profile without an Auth user unexpectedly succeeded';
    exception when foreign_key_violation then null;
    end;
end;
$test$;

-- Administrative profile deletion is not an Auth-account deletion operation.
delete from public.profiles where id = '10000000-0000-4000-8000-000000000002';
do $test$
begin
    if not exists (select 1 from auth.users where id = '10000000-0000-4000-8000-000000000002') then
        raise exception 'Deleting a profile unexpectedly deleted its Auth account';
    end if;
    raise notice 'All profiles authorization and lifecycle assertions passed; rolling back fixtures';
end;
$test$;

rollback;

"""Offline structural checks only; these do not execute or parse PostgreSQL."""
from pathlib import Path
import re
import unittest

SQL = (Path(__file__).resolve().parents[1] / "database/supabase/tests/profiles.test.sql").read_text(encoding="utf-8")


class ProfilesHarnessStructure(unittest.TestCase):
    def test_fail_fast_and_disposable_guards_precede_fixtures(self):
        first_fixture = SQL.index("insert into auth.users (id, email, raw_user_meta_data)")
        for guard in ("\\set ON_ERROR_STOP on", "profiles_test_target_ok", "lock table auth.users, public.profiles", "Refusing nonempty target", "rolbypassrls", "Profiles RLS is not enabled"):
            self.assertLess(SQL.index(guard), first_fixture, guard)

    def test_rollback_and_balanced_blocks(self):
        self.assertEqual(SQL.count("$test$") % 2, 0)
        self.assertRegex(SQL, r"(?im)^begin;\s*$")
        self.assertRegex(SQL, r"(?im)^rollback;\s*$")
        self.assertNotRegex(SQL, r"(?im)^commit\s*;")
        self.assertTrue(SQL.rstrip().endswith("rollback;"))

    def test_two_authenticated_contexts_and_denials(self):
        for marker in ("User A simulated Auth context is incorrect", "User B simulated Auth context is incorrect", "User A can read user B", "User A updated user B", "User B updated user A", "User A inserted a profile under user B ownership", "User B inserted a profile under user A ownership", "User B cannot update their own profile", "Anonymous sign-in can read profiles", "Unauthenticated SELECT unexpectedly succeeded"):
            self.assertIn(marker, SQL)
        self.assertGreaterEqual(len(re.findall(r"(?im)^set local role authenticated;", SQL)), 1)
        self.assertIn("set local role anon;", SQL)
        self.assertIn("exception when insufficient_privilege then null;", SQL)


if __name__ == "__main__":
    unittest.main()

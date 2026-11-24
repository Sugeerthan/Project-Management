"""Offline checks of psql guard structure; these do not execute SQL."""
from pathlib import Path
import re
import unittest

HARNESS = Path(__file__).with_name("profiles.test.sql")
SQL = HARNESS.read_text(encoding="utf-8")


class ProfilesGuardChecks(unittest.TestCase):
    def test_missing_or_wrong_acknowledgement_raise_sql_errors(self):
        preamble = SQL.split("\n\nbegin;", 1)[0]
        self.assertRegex(
            preamble,
            r"(?s)\\set ON_ERROR_STOP on\s+\\if :\{\?profiles_test_target\}"
            r".*?select :'profiles_test_target' = 'nexus-profiles-disposable'"
            r" as profiles_test_target_ok \\gset\s+\\if :profiles_test_target_ok"
            r"\s+\\else\s+do \$guard\$\s+begin\s+raise exception "
            r"'Refusing test: explicitly acknowledge nexus-profiles-disposable';"
            r"\s+end;\s+\$guard\$;\s+\\endif\s+\\else\s+"
            r"do \$guard\$\s+begin\s+raise exception "
            r"'Refusing test: profiles_test_target is required';"
            r"\s+end;\s+\$guard\$;\s+\\endif\s*$",
        )
        self.assertNotRegex(SQL, r"(?im)^\s*\\q(?:uit)?(?:\s|$)")
        self.assertEqual(preamble.count("raise exception"), 2)
        self.assertNotIn("insert into auth.users", preamble.lower())

    def test_nonempty_check_fails_before_fixtures_under_lock(self):
        lock = SQL.index("lock table auth.users, public.profiles in share row exclusive mode;")
        check = SQL.index("if exists (select 1 from auth.users) or exists (select 1 from public.profiles)")
        reject = SQL.index("raise exception 'Refusing nonempty target")
        fixture = SQL.index("insert into auth.users (id, email, raw_user_meta_data)")
        self.assertLess(lock, check)
        self.assertLess(check, reject)
        self.assertLess(reject, fixture)

    def test_transaction_and_timeout_safeguards_remain(self):
        for setting in ("lock_timeout = '3s'", "statement_timeout = '30s'", "idle_in_transaction_session_timeout = '60s'"):
            self.assertIn("set local " + setting + ";", SQL)
        self.assertTrue(SQL.rstrip().endswith("rollback;"))
        self.assertNotRegex(SQL, r"(?im)^\s*commit\s*;")
        self.assertEqual(SQL.count("$guard$"), 4)
        self.assertEqual(SQL.count("$test$") % 2, 0)


if __name__ == "__main__":
    unittest.main()

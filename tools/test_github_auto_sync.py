import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("auto_sync", Path(__file__).with_name("github_auto_sync.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.remote, self.a, self.b = (root / name for name in ("origin.git", "computer-a", "computer-b"))
        self.run_git("init", "--bare", "--initial-branch=main", str(self.remote))
        self.run_git("clone", str(self.remote), str(self.a))
        self.configure(self.a)
        (self.a / ".gitignore").write_text(".env\nnode_modules/\n")
        (self.a / "app.txt").write_text("initial\n")
        self.commit(self.a, "Initial")
        self.run_git("-C", str(self.a), "push", "-u", "origin", "main")
        self.run_git("clone", str(self.remote), str(self.b))
        self.configure(self.b)

    def run_git(self, *args):
        return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL, text=True,
            env={**os.environ, "GIT_CONFIG_NOSYSTEM": "1"}).strip()

    def configure(self, repo):
        for key, value in [("user.name", "Sync Test"), ("user.email", "sync@example.invalid"), ("commit.gpgsign", "false"), ("core.hooksPath", "/dev/null")]:
            self.run_git("-C", str(repo), "config", key, value)

    def commit(self, repo, message):
        self.run_git("-C", str(repo), "add", "--all")
        self.run_git("-C", str(repo), "commit", "-m", message)

    def head(self, repo):
        return self.run_git("-C", str(repo), "rev-parse", "HEAD")

    def test_edits_upload_then_download_on_other_computer(self):
        (self.a / "app.txt").write_text("unfinished work\n")
        (self.a / "new.txt").write_text("new file\n")
        self.assertTrue(sync.run_repo(self.a))
        self.assertEqual(self.head(self.a), self.head(self.remote))
        self.assertTrue(sync.run_repo(self.b))
        self.assertEqual((self.b / "app.txt").read_text(), "unfinished work\n")
        self.assertTrue((self.b / "new.txt").exists())

    def test_deletions_upload_and_ignored_files_stay_local(self):
        (self.a / "app.txt").unlink()
        (self.a / ".env").write_text("TOKEN=not-a-real-token\n")
        (self.a / "node_modules").mkdir()
        (self.a / "node_modules/cache").write_text("cache")
        self.assertTrue(sync.run_repo(self.a))
        tree = self.run_git("--git-dir", str(self.remote), "ls-tree", "--name-only", "HEAD")
        self.assertEqual(tree, ".gitignore")
        self.assertTrue((self.a / ".env").exists())

    def test_remote_changes_with_local_edits_preserve_both(self):
        (self.a / "app.txt").write_text("remote version\n")
        self.assertTrue(sync.run_repo(self.a))
        before = self.head(self.b)
        (self.b / "app.txt").write_text("local version\n")
        self.assertFalse(sync.run_repo(self.b))
        self.assertEqual(self.head(self.b), before)
        self.assertEqual((self.b / "app.txt").read_text(), "local version\n")
        self.assertEqual(self.head(self.remote), self.head(self.a))

    def test_diverged_commits_are_not_force_pushed(self):
        (self.a / "app.txt").write_text("first computer\n")
        self.assertTrue(sync.run_repo(self.a))
        (self.b / "app.txt").write_text("second computer\n")
        self.commit(self.b, "Local commit")
        before = self.head(self.b)
        self.assertFalse(sync.run_repo(self.b))
        self.assertEqual(self.head(self.b), before)
        self.assertNotEqual(self.head(self.remote), before)

    def test_manually_staged_work_is_not_committed(self):
        (self.a / "app.txt").write_text("staged work\n")
        self.run_git("-C", str(self.a), "add", "app.txt")
        before = self.head(self.a)
        self.assertFalse(sync.run_repo(self.a))
        self.assertEqual(self.head(self.a), before)
        self.assertIn("app.txt", self.run_git("-C", str(self.a), "diff", "--cached", "--name-only"))

    def test_offline_changes_retry_after_connection_returns(self):
        (self.a / "app.txt").write_text("offline work\n")
        self.run_git("-C", str(self.a), "remote", "set-url", "origin", str(self.remote) + "-missing")
        self.assertFalse(sync.run_repo(self.a))
        self.assertEqual((self.a / "app.txt").read_text(), "offline work\n")
        self.run_git("-C", str(self.a), "remote", "set-url", "origin", str(self.remote))
        self.assertTrue(sync.run_repo(self.a))

    def test_pause_and_git_operations_preserve_work(self):
        (self.a / "app.txt").write_text("pending work\n")
        before = self.head(self.a)
        for marker in ("codex-autosync.paused", "MERGE_HEAD", "index.lock"):
            path = self.a / ".git" / marker
            path.touch()
            self.assertFalse(sync.run_repo(self.a))
            self.assertEqual(self.head(self.a), before)
            path.unlink()

    def test_duplicate_worker_does_not_commit(self):
        (self.a / "app.txt").write_text("pending work\n")
        before = self.head(self.a)
        with sync.repo_lock(self.a / ".git/codex-autosync.lock"):
            self.assertFalse(sync.run_repo(self.a))
        self.assertEqual(self.head(self.a), before)


if __name__ == "__main__":
    unittest.main()

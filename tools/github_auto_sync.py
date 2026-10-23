#!/usr/bin/env python3
"""Back up saved Git changes without force pushes, rebases, or conflict resolution."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess


class Paused(RuntimeError):
    pass


def git(repo, *args, check=True):
    result = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True,
        timeout=25, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Git command failed")
    return result


@contextmanager
def repo_lock(path):
    with path.open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            handle.seek(0)
            handle.write(b"0")
            handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError as exc:
                raise Paused("Another sync is running") from exc
        else:
            import fcntl
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise Paused("Another sync is running") from exc
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def synchronize(repo):
    """Return only after the current branch is clean and its commits are pushed."""
    git_dir = Path(git(repo, "rev-parse", "--absolute-git-dir").stdout.strip())
    if (git_dir / "codex-autosync.paused").exists():
        raise Paused("Paused by user")
    for marker in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "sequencer", "index.lock"):
        if (git_dir / marker).exists():
            raise Paused("Finish the current Git operation before automatic sync")
    branch = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD", check=False)
    if branch.returncode:
        raise Paused("Detached HEAD; switch to a branch")
    branch = branch.stdout.strip()
    remote = git(repo, "config", "--get", f"branch.{branch}.remote", check=False).stdout.strip()
    remote_ref = git(repo, "config", "--get", f"branch.{branch}.merge", check=False).stdout.strip()
    if remote != "origin" or not remote_ref.startswith("refs/heads/"):
        raise Paused("Publish this branch to origin in VS Code before automatic sync")
    staged = git(repo, "diff", "--cached", "--quiet", check=False)
    if staged.returncode == 1:
        raise Paused("Files are staged for a manual commit; commit or unstage them to resume")
    if staged.returncode:
        raise RuntimeError(staged.stderr.strip() or "Could not inspect staging area")
    git(repo, "fetch", "--quiet", "origin")
    ahead, behind = map(int, git(repo, "rev-list", "--left-right", "--count", "HEAD...@{upstream}").stdout.split())
    dirty = bool(git(repo, "status", "--porcelain=v1", "--untracked-files=all").stdout)
    if behind and (ahead or dirty):
        raise Paused("Both this computer and GitHub have changes; reconcile them in VS Code")
    if behind:
        git(repo, "merge", "--ff-only", "@{upstream}")
    if dirty:
        git(repo, "add", "--all")
        changed = git(repo, "diff", "--cached", "--quiet", check=False)
        if changed.returncode == 1:
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            git(repo, "commit", "-m", f"autosave: {socket.gethostname()} {stamp}")
        elif changed.returncode:
            raise RuntimeError(changed.stderr.strip() or "Could not inspect saved changes")
    git(repo, "push", "--quiet", "origin", f"HEAD:{remote_ref}")
    if git(repo, "status", "--porcelain=v1", "--untracked-files=all").stdout:
        return "Pending: newer edits will be saved on the next pass"
    return f"Synced {branch} at {git(repo, 'rev-parse', '--short', 'HEAD').stdout.strip()}"


def run_repo(repo):
    repo = Path(repo).resolve()
    try:
        git_dir = Path(git(repo, "rev-parse", "--absolute-git-dir").stdout.strip())
        with repo_lock(git_dir / "codex-autosync.lock"):
            try:
                message = synchronize(repo)
                ok = message.startswith("Synced")
            except (RuntimeError, subprocess.TimeoutExpired) as exc:
                message, ok = str(exc), False
            status = {"repo": str(repo), "checked_at": datetime.now(timezone.utc).isoformat(), "ok": ok, "message": message}
            status_path = git_dir / "codex-autosync-status.json"
            temporary = status_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(status, indent=2) + "\n")
            temporary.replace(status_path)
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as exc:
        message, ok = str(exc), False
    print(f"{repo.name}: {message}", flush=True)
    return ok


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", action="append", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--status", action="store_true")
    mode.add_argument("--pause", action="store_true")
    mode.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.status or args.pause or args.resume:
        for repo in args.repo:
            git_dir = Path(git(repo, "rev-parse", "--absolute-git-dir").stdout.strip())
            if args.pause:
                (git_dir / "codex-autosync.paused").touch()
                print(f"{repo.name}: paused (an in-progress sync may finish)")
            elif args.resume:
                (git_dir / "codex-autosync.paused").unlink(missing_ok=True)
                print(f"{repo.name}: resumes on the next timer pass")
            else:
                path = git_dir / "codex-autosync-status.json"
                print(path.read_text() if path.exists() else f"{repo.name}: no sync has run yet")
        return 0
    results = [run_repo(repo) for repo in args.repo]
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())

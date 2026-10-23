#!/usr/bin/env python3
"""Create a two-repo VS Code workspace and install Linux automatic GitHub sync."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys


def unit_arg(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory-monitor", type=Path)
    parser.add_argument("--workspace", type=Path)
    args = parser.parse_args()
    if not sys.platform.startswith("linux"):
        parser.error("The automatic service installer currently requires Linux with systemd.")
    airtable = Path(__file__).resolve().parents[1]
    monitor = (args.directory_monitor or airtable.parent / "directory-monitor").resolve()
    workspace = (args.workspace or airtable.parent / "Development.code-workspace").resolve()
    repos = [airtable, monitor]
    for repo in repos:
        actual = subprocess.check_output(["git", "-C", str(repo), "rev-parse", "--show-toplevel"], text=True).strip()
        if Path(actual).resolve() != repo:
            parser.error(f"Not a repository root: {repo}")
    account = json.loads(subprocess.check_output(["gh", "api", "user"], text=True))
    private_email = f"{account['id']}+{account['login']}@users.noreply.github.com"
    for repo in repos:
        subprocess.run(["git", "-C", str(repo), "config", "user.email", private_email], check=True)
        author = subprocess.run(["git", "-C", str(repo), "config", "--get", "user.name"], capture_output=True, text=True)
        if not author.stdout.strip():
            subprocess.run(["git", "-C", str(repo), "config", "user.name", account["login"]], check=True)
    script = airtable / "tools/github_auto_sync.py"
    command = [sys.executable, "-u", str(script)]
    for repo in repos:
        command += ["--repo", str(repo)]
    tasks = []
    for label, extra in [("Check sync status", ["--status"]), ("Sync now", []), ("Pause automatic sync", ["--pause"]), ("Resume automatic sync", ["--resume"])]:
        tasks.append({"label": f"GitHub: {label}", "type": "process", "command": command[0], "args": command[1:] + extra, "problemMatcher": [], "presentation": {"reveal": "always", "panel": "dedicated"}})
    content = {
        "folders": [{"name": repo.name, "path": os.path.relpath(repo, workspace.parent)} for repo in repos],
        "settings": {"files.autoSave": "afterDelay", "files.autoSaveDelay": 1000, "git.autofetch": True},
        "tasks": {"version": "2.0.0", "tasks": tasks},
    }
    if workspace.exists() and workspace.read_text() != json.dumps(content, indent=2) + "\n":
        backup = workspace.with_suffix(".code-workspace.before-auto-sync")
        if backup.exists():
            parser.error(f"Existing workspace backup would be overwritten: {backup}")
        backup.write_bytes(workspace.read_bytes())
    workspace.parent.mkdir(parents=True, exist_ok=True)
    workspace.write_text(json.dumps(content, indent=2) + "\n")
    units = Path.home() / ".config/systemd/user"
    units.mkdir(parents=True, exist_ok=True)
    service = units / "repo-autosync.service"
    timer = units / "repo-autosync.timer"
    for path in (service, timer):
        if path.exists() and "Created by setup_github_sync.py" not in path.read_text():
            parser.error(f"An unrelated service exists: {path}")
    service.write_text(
        "# Created by setup_github_sync.py\n[Unit]\nDescription=Automatically save development repos to GitHub\n\n"
        "[Service]\nType=oneshot\nTimeoutStartSec=180\nUMask=0077\n"
        + "ExecStart=" + " ".join(map(unit_arg, command)) + "\n"
    )
    timer.write_text(
        "# Created by setup_github_sync.py\n[Unit]\nDescription=Sync development repos with GitHub every 30 seconds\n\n"
        "[Timer]\nOnActiveSec=10s\nOnUnitInactiveSec=30s\nAccuracySec=1s\nUnit=repo-autosync.service\n\n"
        "[Install]\nWantedBy=timers.target\n"
    )
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "repo-autosync.timer"], check=True)
    print(f"Workspace: {workspace}\nAutomatic sync is enabled while you are logged in.")
    print("VS Code: Terminal > Run Task > GitHub: Check sync status")


if __name__ == "__main__":
    main()

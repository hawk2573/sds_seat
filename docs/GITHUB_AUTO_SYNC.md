# Working on both repos across computers

Open `Development.code-workspace` in the parent folder that contains your repos. Its Explorer shows `airtable-seat-assignments` and `directory-monitor` together. They remain separate GitHub repositories.

This computer saves editor changes after a one-second pause. A Linux user timer checks both repositories about every 30 seconds while you are logged in, including when VS Code is closed. Saved changes become `autosave: ...` commits and are pushed to the current branch's configured `origin` branch. Clean repositories receive newer commits with a fast-forward pull.

Before switching computers, choose **Terminal → Run Task → GitHub: Sync now**, then **GitHub: Check sync status**. Both repositories should say `Synced` with a recent timestamp. Unsaved editor buffers, offline changes, and failed pushes are not yet on GitHub.

## Controls in VS Code

Use **Terminal → Run Task**:

- **GitHub: Check sync status** displays the last check and any problem for each repository.
- **GitHub: Sync now** commits and uploads saved work immediately.
- **GitHub: Pause automatic sync** pauses both repos; a pass already in progress may finish.
- **GitHub: Resume automatic sync** resumes on the next timer pass.

The service respects `.gitignore`. Login tokens, `.env` files, dependencies, build output, and Directory Monitor's ignored archive/data folders stay local. This synchronizes project files, not Airtable records, databases, running processes, or the entire computer.

Work on one computer at a time. If GitHub and the local computer both have new work, automatic sync pauses that repo and reports the problem. Resolve it in VS Code; the next pass retries. It never force pushes, discards edits, rebases, or resolves conflicts automatically. Manually staged files also pause automatic commits so an intentional commit can be completed. New branches need **Publish Branch** once in VS Code.

## First setup on another Linux computer

Install VS Code, Git, Python 3, and GitHub CLI. In a terminal:

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git --hostname github.com
mkdir -p ~/repos
cd ~/repos
git clone https://github.com/tacocloudmin/airtable-seat-assignments.git
git clone https://github.com/tacocloudmin/directory-monitor.git
python3 airtable-seat-assignments/tools/setup_github_sync.py
code Development.code-workspace
```

If a repository is already cloned, open that folder and pull; do not clone over it. The installer configures each repo to use your GitHub privacy email and supplies your GitHub username as the author name if no name is configured. Install each project's dependencies on that computer (`npm ci` for the Airtable extension), and configure its local credentials there.

The installer currently targets Linux with a systemd user session. Windows and macOS need an equivalent startup scheduler; the sync worker itself uses Python's standard library and Git. Running VS Code's Settings Sync does not install this service or transfer your repository files.

## Service maintenance

```bash
systemctl --user status repo-autosync.timer
journalctl --user -u repo-autosync.service -n 30 --no-pager
systemctl --user disable --now repo-autosync.timer
```

The last command disables future automatic passes. Re-enable with `systemctl --user enable --now repo-autosync.timer`. Status and pause files are stored inside each repository's `.git` directory. Re-run the installer if you move the folders. The generated workspace uses paths relative to its own location.

Validation: `python3 tools/test_github_auto_sync.py` uses temporary local Git remotes and two simulated computers to verify uploads, downloads, deletions, ignored files, offline retries, conflict handling, and pauses.

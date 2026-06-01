# superherd

Bridge Superset workspaces into Herdr.

`superherd` creates a Superset worktree, opens it as a Herdr workspace, mirrors any Superset setup terminals into Herdr tabs, then focuses a final local shell tab.

## Install

```sh
npm i -g superherd
```

The package installs two equivalent binaries:

```sh
superherd --help
hs --help
```

## Requirements

- Bun available on PATH for the published CLI runtime.
- Superset host service running on this machine.
- Herdr installed and running on this machine.
- The current git repository imported into Superset.

## Usage

Run from inside a Superset-imported git repository or an existing Superset worktree:

```sh
hs create my-branch "My Workspace"
hs create my-branch --from staging "My Workspace"
hs inherit existing-unchecked-out-branch "Existing Branch Workspace"
hs create my-branch "My Workspace" --eject
```

This will:

1. create or reuse a Superset workspace for `my-branch`
2. derive the Superset worktree path
3. create a Herdr workspace at that path
4. open Superset setup terminals as Herdr tabs
5. create and focus a final local Herdr shell tab

## Options

```sh
hs create <new-branch> --from <base-branch-or-ref> <name...>
hs create <branch> <name...> --project <id-or-name>
hs inherit <existing-unchecked-out-branch> <name...>
hs create <branch> <name...> --dry-run
hs create <branch> <name...> --verbose
hs create <branch> <name...> --no-setup-terminals
hs create <branch> <name...> --no-shell-tab
hs create <branch> <name...> --eject
```

`--project` accepts a Superset project id, repo name, or `owner/name`. `inherit` fails before calling Superset if git reports the branch is already checked out in any worktree.

When run from inside an existing Superset worktree, `create` and `inherit` resolve the original Superset project automatically. `--eject` closes the invoking Herdr pane after a successful create/inherit when `HERDR_PANE_ID` is available.

## Identify and Teardown

Detect whether the current directory is inside a local Superset workspace:

```sh
hs identify
hs identify --json
```

Delete the Superset workspace for the current directory:

```sh
hs teardown
```

`teardown` runs `superset ws delete <workspace-id>` from a neutral working directory after identifying the current workspace. Use `--dry-run` to print the command without running it.

## Terminal Bridge

Setup terminals are attached through an internal command:

```sh
hs attach-terminal --workspace <superset-workspace-id> --terminal <terminal-id>
```

The bridge forwards Ctrl-C to the Superset PTY. Typing `exit` at the start of a line closes the local bridge instead of sending `exit` to the remote terminal.

## Notes

`superherd` talks to Superset's local host-service HTTP API directly instead of shelling out to the Superset CLI. This avoids repo-local Bun configuration interfering with Superset CLI startup.

Herdr integration uses Herdr's CLI wrappers over its socket API.

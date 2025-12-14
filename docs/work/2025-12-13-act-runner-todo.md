## TODO

- Create a `.act` directory at repo root.
- Add a helper script `.act/run.sh` to invoke workflows in `.github` through `act` with:
  - ability to run each workflow
  - ability to provide secrets for the workflow while keeping secrets out of git (use `gh` to list secret names)
  - ability to provide variables for the workflow pulled from `gh variable list`
  - flags: `--pull=false`, `--secret-file`, `--var-file`, `--env-file`, `--use-new-action-cache`, `--artifact-server-path` storing artifacts in gitignored `.act/.artifacts`, `--cache-server-path` in gitignored `.act/.cache`, mapping `ubuntu-latest` to `cattlehacker/ubuntu`, and a `GITHUB_TOKEN` secret from `$(gh auth token)` when the script runs
  - script resides inside `.act` and named `run.sh`

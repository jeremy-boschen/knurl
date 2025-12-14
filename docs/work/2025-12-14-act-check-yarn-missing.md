## TODO

- Fix `.act/run.sh check` failure where `actions/setup-node@v4` cannot find `yarn` on `ubuntu-latest` by ensuring Yarn 4 is available before `yarn install --immutable`.
- Verify the updated `check` workflow passes locally with `./.act/run.sh check`.

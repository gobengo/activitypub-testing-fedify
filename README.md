# activitypub-testing-fedify

[activitypub-testing](https://activitypub-testing.socialweb.coop/) + [fedify](https://fedify.dev/)

This repository runs the activitypub-testing test runner against a simple server powered by fedify.

## getting started

1. clone this repo
2. install dependencies `npm ci`
3. run tests with `npm test`

## scripts

### `bin/docker-herokuish-buildpack-test`

[runs `herokuish buildpack test`](https://github.com/gliderlabs/herokuish?tab=readme-ov-file#running-an-app-tests-using-heroku-buildpacks) in a docker container. Herokuish should detect that this is a nodejs package, use heroku-buildpack-nodejs, and eventually `npm install` and `npm test`.

```shell
⚡ ./bin/docker-herokuish-buildpack-test
```

## github workflows

`/.github/workflows/` contains workflow definitions.

### workflows

#### main

main workflow. runs on every push.

##### jobs

###### test

test the activitypub-testing-fedify package using `npm test`.

### run locally with nektos/act

Install [nektos/act](https://nektosact.com/introduction.html).

Then see jobs like

```
⚡ act -l
Stage  Job ID  Job name  Workflow name  Workflow file  Events
0      test    test      CI             main.yaml      push  
```

Run all with `act` or a named job like `act -j test`

```shell
⚡ act -j test
[CI/test] 🚀  Start image=ghcr.io/catthehacker/ubuntu:act-latest
[CI/test]   🐳  docker pull image=ghcr.io/catthehacker/ubuntu:act-latest platform= username= forcePull=false
…
```

# activitypub-testing-fedify

[activitypub-testing](https://activitypub-testing.socialweb.coop/) + [fedify](https://fedify.dev/)

This repository runs the activitypub-testing test runner against a simple server powered by fedify.

## getting started

1. clone this repo
2. install dependencies `npm ci`
3. run tests with `npm test`

## scripts

### `bin/activitypub-testing`

runs `server.ts`, then run `activitypub-testing test actor` against the running server.

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
Stage  Job ID           Job name                                                          Workflow name             Workflow file             Events                
0      test-actor       `activitypub-testing test actor` node=${{ matrix.node-version }}  activitypub-testing.yaml  activitypub-testing.yaml  push,workflow_dispatch
0      test-actor-yaml  test-actor-yaml                                                   activitypub-testing.yaml  activitypub-testing.yaml  push,workflow_dispatch
0      test             test                                                              main.yaml                 main.yaml                 push                  

```

Run all with `act` or a named job like `act -j test-actor`

```shell
⚡ act -j test-actor     
[activitypub-testing.yaml/`activitypub-testing test actor` node=21.x-2] 🚀  Start image=ghcr.io/catthehacker/ubuntu:act-latest
[activitypub-testing.yaml/`activitypub-testing test actor` node=20.x-1] 🚀  Start image=ghcr.io/catthehacker/ubuntu:act-latest
…
```

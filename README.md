# Migration tool for JS IPFS Repo

[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/project-IPFS-blue.svg?style=flat-square)](http://ipfs.io/)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
![](https://img.shields.io/badge/npm-%3E%3D3.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D10.0.0-orange.svg?style=flat-square)

> Migration framework for versioning of JS IPFS Repo

This package takes inspiration from similar tool used by Go-IPFS: [fs-repo-migrations](https://github.com/ipfs/fs-repo-migrations/)

## Lead Maintainer

???

## Table of Contents

- [Background](#background)
- [Install](#install)
  - [npm](#npm)
  - [Use in Node.js](#use-in-nodejs)
  - [Use in a browser with browserify, webpack or any other bundler](#use-in-a-browser-with-browserify-webpack-or-any-other-bundler)
  - [Use in a browser Using a script tag](#use-in-a-browser-using-a-script-tag)
- [Usage](#usage)
  - [Writing migration](#writing-migration)
  - [Migrations matrix](#migrations-matrix)
- [API](#api)
- [CLI](#cli)
- [Contribute](#contribute)
- [License](#license)

## Background

As JS-IPFS evolves and new technologies, algorithms and data structures are being incorporated it is necessary to 
enable users easy transition between versions. Different versions of JS-IPFS may expect different structure or content
of the IPFS repo (see: [IPFS repo spec](https://github.com/ipfs/specs/tree/master/repo), [JS implementation](https://github.com/ipfs/js-ipfs-repo) ).
For that reason IPFS repo is versioned and this package provides framework to create migrations which transits
one version of IPFS repo into next/previous one.

This framework provides:
 * Handles locking/unlocking of repository
 * Defines migrations API
 * Executes and reports migrations in both direction: forward and backward
 * Simplifies creation of new migrations

## Install

### npm

```sh
> npm install ipfs-repo-migrations
```

### Use in Node.js

```js
const migrations = require('ipfs-repo-migrations')
```

### Use in a browser with browserify, webpack or any other bundler

```js
const migrations = require('ipfs-repo-migrations')
```

## Usage

Example:

```js
const migrations = require('ipfs-repo-migrations')
const getVersion = require('ipfs-repo-migrations/repo/version')

const repoPath = 'some/repo/path'
const repoVersion = await getVersion(repoPath)

if(repoVersion < migrations.getLatestMigrationVersion()){
  // Old repo! Lets migrate to latest version!
  await migrations.migrate(repoPath)
}
```

On how to migrate your repository using CLI, you can find the recommended steps in [how to run migrations](./run.md) tutorial. 

**For tools that build on top of `js-ipfs` and run mainly in the browser environment, be aware of disabling automatic
migrations as user does not have any other way how to run the migrations because of lack of CLI in browser. In such
a case, you should provide a way how to trigger migrations manually.**

### Writing migration

Migrations are one of those things that can be extremely painful on users. At the end of the day, we want users never to have to think about it. The process should be:

- SAFE. No data lost. Ever.
- Revertible. Tools must implement forward and backward migrations.
- Frozen. After the tool is written, all code must be frozen and vendored.
- To Spec. The tools must conform to the spec.

#### Architecture of migrations

All migrations are placed in `/migrations` folder. Each folder there represents one migration that behaves as stand-alone
package that has its own `package.json` file that states migration's dependencies, has its own tests and follows migration
API. 

All migrations are collected in `/migrations/index.js`, which should not be edited manually is it is regenerated on
every run of `jsipfs-migrations add` (or the manual changes should follow same style of modifications). 
The order of migrations is important and the migrations have to be sorted in the growing order.

Each migration has to follow this API. It has to export object in its `index.js` that has following properties:

 * `version` (int) - Number that represents the version into which will be the repo migrated to (eq. `migration-8` will move the repo into version 8).
 * `description` (string) - Brief description of what the migrations does.
 * `migrate` (function) - Function that on execution will perform the migration, see signature of this function bellow.
 * `revert` (function) - If defined then this function will be used to revert the migration to previous version. Otherwise it is assumed that it is not possible to revert this migration.

##### `migrate(repoPath, isBrowser)`

_Do not confuse this function with the `require('ipfs-repo-migrations').migrate()` function that drives the whole migration process!_

Arguments:
 * `repoPath` (string) - absolute path to the root of the repo
 * `options` (object, optional) - object containing `IPFSRepo` options, that should be used to construct datastore instance.
 * `isBrowser` (bool) - indicates if the migration is run in browser environment in oppose to NodeJS
 
##### `revert(repoPath, isBrowser)`

_Do not confuse this function with the `require('ipfs-repo-migrations').revert()` function that drives the whole backward migration process!_

Arguments:
 * `repoPath` (string) - path to the root of the repo
 * `options` (object, optional) - object containing `IPFSRepo` options, that should be used to construct datastore instance.
 * `isBrowser` (bool) - indicates if the migration is run in browser environment in oppose to NodeJS

#### Browser vs. NodeJS environments

Migration might need to distinguish in what environment it runs (browser vs. NodeJS), for this reason there is the argument
`isBrowser` passed to migrations functions. But with simple migrations it should not be necessary to distinguish between
these environments as datastore implementation will handle the main differences. 

There are currently two main datastore implementations:
 1. [`datastore-fs`](https://github.com/ipfs/js-datastore-fs) that is backed by file system and is used mainly in NodeJS environment
 2. [`datastore-level`](https://github.com/ipfs/js-datastore-level) that is backed by LevelDB and is used mainly in browser environment
 
 Both implementations share same API and hence are interchangeable. 
 
 When the migration is run in browser environment the `datastore-fs` is automatically replaced with `datastore-level` even
 when it is directly imported (`require('datastore-fs')` will return `datastore-level` in browser). Because of this mechanism
 with simple migrations you should not worry about difference between `datastore-fs` and `datastore-level` and by default 
 use the `datastore-fs` package (as the replace mechanism does not work vice vera).

#### Guidelines

The recommended way to write a new migration is to first bootstrap an dummy migration using the CLI:

```sh
> jsipfs-migrations add
```

Afterwards new folder is created with bootstrapped migration. You can then simply fill in the required fields and 
write the rest of migration! 

The `node_modules` of the migration should be committed to the repo to ensure that the dependencies are resolved even in
far future, when the package might be removed from registry. 

#### Integration with js-ipfs

When new migration is created, the repo version in [`js-ipfs-repo`](https://github.com/ipfs/js-ipfs-repo) should be updated with the new version.
After releasing the updated version of `js-ipfs-repo` this version should be propagated into `js-ipfs` together with
updated version of this package.

#### Tests

If migration affects working of any of the following functionality, it has to provide tests for the following functions
 to work under the version of the repo that it migrates to:

* `/src/repo/version.js`:`getVersion()` - retrieving repository's version
* `/src/repo/lock.js`:`lock()` - locking repository that uses file system
* `/src/repo/lock-memory.js`:`lock()` - locking repository that uses memory

Migration has to have a test coverage. Tests for migration should be placed in `/test/migrations/` folder. Most probably
you will have to plug the tests into `browser.js`/`node.js` if they require specific bootstrap on each platform.

#### Empty migrations

For inter-operable reasons with Go-IPFS it might be necessary just to bump a version of repo without any actual 
modification as there might not be any changes needed in JS implementation. For that you can create "empty migration".

The easiest way is to use the CLI for that:

```sh
> jsipfs-migrations add --empty
```

This will create empty migration with next version in line.

### Migrations matrix

| IPFS repo version  | JS IPFS version  |
| -----------------: |:----------------:|
|                  7 | v0.0.0 - latest  |


## API

### `migrate(path, {toVersion, ignoreLock, repoOptions, onProgress, isDryRun}) -> Promise<void>`

Executes forward migration to specific version or if not specified to the latest version.

**Arguments:**

 * `path` (string, mandatory) - path to the repo to be migrated
 * `options` (object, optional) - options for the migration
 * `options.toVersion` (int, optional) - version to which the repo should be migrated to. If left out the version of latest migration is used.
 * `options.ignoreLock` (bool, optional) - if true won't lock the repo for applying the migrations. Use with caution.
 * `options.repoOptions` (object, optional) - options that are passed to migrations, that use them to correctly construct datastore. Options are same like for IPFSRepo.
 * `options.onProgress` (function, optional) - callback that is called after finishing execution of each migration to report progress.
 * `options.isDryRun` (bool, optional) - flag that indicates if it is a dry run that should imitate running migration without actually any change.
 
#### `onProgress(migration, counter, totalMigrations)`
 
Signature of the progress callback.

**Arguments:**
 * `migration` (object) - object of migration that just successfully finished running. See [Architecture of migrations](#architecture-of-migrations) for details.
 * `counter` (int) - current number of migration in the planned migrations streak.
 * `totalMigrations` (int) - total count of migrations that are planned to be run.

### `revert(path, toVersion, {ignoreLock, options, onProgress, isDryRun}) -> Promise<void>`

Executes backward migration to specific version.

**Arguments:**

 * `path` (string, mandatory) - path to the repo to be reverted
 * `toVersion` (int, mandatory) - version to which the repo should be reverted to. 
 * `options` (object, optional) - options for the reversion
 * `options.ignoreLock` (bool, optional) - if true won't lock the repo for applying the migrations. Use with caution.
 * `options.options` (object, optional) - options that are passed to migrations, that use them to correctly construct datastore. Options are same like for IPFSRepo.
 * `options.onProgress` (function, optional) - callback that is called after finishing execution of each migration to report progress.
 * `options.isDryRun` (bool, optional) - flag that indicates if it is a dry run that should imitate running migration without actually any change.
 
### `getLatestMigrationVersion() -> int`

Return the version of latest migration.

## CLI

The package comes also with CLI that is exposed as NodeJS binary with name `jsipfs-repo-migrations`. 
It has several commands:

 * `migrate` - performs forward/backward migration to specific or latest version.
 * `status` - check repo for migrations that should be run.
 * `add` - bootstraps new migration.
 
For further details see the `--help` pages.

## Contribute

There are some ways you can make this module better:

- Consult our [open issues](https://github.com/ipfs/js-ipfs-repo/issues) and take on one of them
- Help our tests reach 100% coverage!

This repository falls under the IPFS [Code of Conduct](https://github.com/ipfs/community/blob/master/code-of-conduct.md).

[![](https://cdn.rawgit.com/jbenet/contribute-ipfs-gif/master/img/contribute.gif)](https://github.com/ipfs/community/blob/master/contributing.md)

## License

[MIT](LICENSE)

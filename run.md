# Running Repo Migrations

This document explains how to run [repo](https://github.com/ipfs/specs/tree/master/repo/) migrations for [js-ipfs](https://github.com/ipfs/js-ipfs).

Note that running migrations is a task automatically performed by the `js-ipfs` when running the `js-ipfs` command after installing its new version, so you would normally not need to run the `jsipfs-repo-migrations` tool.

The `jsipfs-repo-migrations` comes into play when the internal, on-disk format `js-ipfs` uses to store data changes. In order to avoid losing data, this tool upgrades old versions of the repo to the new ones.

If you run into any trouble, please feel free to [open an issue in this repository](https://github.com/ipfs/js-ipfs-repo-migrations/issues).

## Step 0. Back up your repo (optional)

The migration tool is safe -- it should not delete any data. If you have important data stored _only_ in your ipfs node, and want to be extra safe, you can back up the whole repo with:

```sh
cp -r ~/.js-ipfs ~/.js-ipfs.bak
```

## Step 1. Downloading the Migration

Recommended way is to use `npm` and install this package with it: `npm install ipfs-repo-migrations`

## Step 2. Run the Migration

Now, run the migration tool:

```sh
# you can check if there are migrations that needs to be applied
js-ipfs-repo-migrations status

# if so, you can migrate to the latest version
js-ipfs-repo-migrations migrate
```

## Step 3. Done! Run IPFS.

If the migration completed without error, then you're done! Try running the new ipfs:

```
js-ipfs daemon
```

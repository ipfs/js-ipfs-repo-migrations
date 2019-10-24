# Running Repo Migrations

This document explains how to run [repo](https://github.com/ipfs/specs/tree/master/repo/) migrations for [js-ipfs](https://github.com/ipfs/js-ipfs).

Note that the `js-ipfs` command automatically runs migrations when a new version is installed, so you would normally not need to run the `jsipfs-repo-migrations` tool.

`jsipfs-repo-migrations` comes into play when the internal, on-disk format `js-ipfs` uses to store data changes. To enable the new version of `js-ipfs` to read the new data format, this tool upgrades from an old version of the repo to a new version.

If you run into any trouble, please feel free to [open an issue in this repository](https://github.com/ipfs/js-ipfs-repo-migrations/issues).

## Step 0. Back up your repo (optional)

The migration tool is safe -- it should not delete any data. If you have important data stored _only_ in your ipfs node, and want to be extra safe, you can back up the whole repo with:

```sh
cp -r ~/.jsipfs ~/.jsipfs.backup
```

## Step 1. Downloading the Migration

`npm install ipfs-repo-migrations`

## Step 2. Run the Migration

To run the migration tool:

```sh
# to check if there are migrations that need to be applied
jsipfs-repo-migrations status

# if so, migrate to the latest version
jsipfs-repo-migrations migrate
```

## Step 3. Done! Run IPFS.

If the migration completed without error, then you're done! Try running the new ipfs:

```
jsipfs daemon
```

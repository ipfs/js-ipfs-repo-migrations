#!/bin/sh
#
# Copyright (c) 2014 Christian Couder
# MIT Licensed; see the LICENSE file in this repository.
#

test_description="Test installation and some basic commands"

# setup temp repo
rm -rf ./tmp
cp -r ../test-repo ./tmp
IPFS_PATH=$(echo `pwd`/tmp)
export IPFS_PATH

. lib/test-lib.sh

test_expect_success "current dir is writable" '
	echo "It works!" > test.txt
'

test_expect_success "jsipfs-migrations version succeeds" '
	jsipfs-migrations --version > version.txt
'

test_expect_success "jsipfs-migrations help succeeds" '
	jsipfs-migrations --help > help.txt &&
	grep "migrate" help.txt
'

test_expect_success "jsipfs-migrations status shows migrations are needed" $'
	jsipfs-migrations status --migrations ../test/test-migrations > status.txt &&
	grep "There are migrations to be applied!" status.txt &&
	grep "Current repo version: 1" status.txt &&
	grep "Last migration\'s version: 2" status.txt
'

test_expect_success "jsipfs-migrations successfully migrate to latest version" $'
	jsipfs-migrations migrate --migrations ../test/test-migrations > migrate.txt &&
	grep "Successfully migrated to version 2" migrate.txt
'

test_expect_success "jsipfs-migrations status shows NO migrations are needed" $'
	jsipfs-migrations status --migrations ../test/test-migrations > status.txt &&
	grep "Nothing to migrate!" status.txt &&
	grep "Current repo version: 2" status.txt &&
	grep "Last migration\'s version: 2" status.txt
'

test_expect_success "jsipfs-migrations successfully reverts" $'
	jsipfs-migrations migrate --to 1 --revert-ok --migrations ../test/test-migrations > revert.txt &&
	grep "Successfully reverted version 2" revert.txt
'


test_done

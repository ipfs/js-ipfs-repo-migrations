#!/bin/sh
#
# Copyright (c) 2014 Christian Couder
# MIT Licensed; see the LICENSE file in this repository.
#

test_description="Test installation and some basic commands"

. lib/test-lib.sh

test_expect_success "current dir is writable" '
	echo "It works!" > test.txt
'

test_expect_success "jsipfs-migrations version succeeds" '
	jsipfs-migrations --version > version.txt
'

test_expect_success "jsipfs-migrations help succeeds" '
	jsipfs-migrations --help > help.txt
'

test_done

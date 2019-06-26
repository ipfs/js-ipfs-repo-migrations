# Test framework for go-ipfs
#
# Copyright (c) 2014 Christian Couder
# MIT Licensed; see the LICENSE file in this repository.
#
# We are using sharness (https://github.com/chriscool/sharness)
# which was extracted from the Git test framework.

# add current directory to path.
BIN=$(echo `pwd`/bin)
PATH=${BIN}:${PATH}

# assert the `jsipfs-migrations` we're using is the right one.
if [[ $(which jsipfs-migrations) != ${BIN}/jsipfs-migrations ]]; then
	echo >&2 "Cannot find the test's local jsipfs-migrations tool."
	echo >&2 "Please check test and ipfs tool installation."
	JS_BIN=$(dirname $(dirname "${BIN}"))"/src/cli.js"
	echo >&2 "For jsipfs-migrations, look for a symlink from '${BIN}/jsipfs-migrations' to '${JS_BIN}'."
	echo >&2 "Use 'make' or 'make deps' as it should install this symlink."
	exit 1
fi

# set sharness verbosity. we set the env var directly as
# it's too late to pass in --verbose, and --verbose is harder
# to pass through in some cases.
test "$TEST_VERBOSE" = 1 && verbose=t

SHARNESS_LIB="lib/sharness/sharness.sh"

. "$SHARNESS_LIB" || {
	echo >&2 "Cannot source: $SHARNESS_LIB"
	echo >&2 "Please check Sharness installation."
	exit 1
}

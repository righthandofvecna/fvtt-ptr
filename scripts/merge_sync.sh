# /bin/bash

# using the gh tool, find all open pull requests that are going to the content_sync branch that are passing CI
# gh pr list --repo righthandofvecna/fvtt-ptr --base content-sync --state open --json number,title,mergeable,statusCheckRollup | jq -r '.[] | select(.mergeable == "MERGEABLE" and .statusCheckRollup.[].conclusion == "SUCCESS") | "\(.number) \(.title)"'
# then, merge them
gh pr list --repo righthandofvecna/fvtt-ptr --base content-sync --state open --json number,title,mergeable,statusCheckRollup | jq -r '.[] | select(.mergeable == "MERGEABLE" and .statusCheckRollup.[].conclusion == "SUCCESS") | "\(.number)"' | while read pr; do
  gh pr merge "$pr" --repo righthandofvecna/fvtt-ptr --merge
done

# Then, notify the user about any pull requests that could not be merged or did not pass CI
echo "Pull requests that could not be merged or did not pass CI:"
gh pr list --repo righthandofvecna/fvtt-ptr --base content-sync --state open --json number,title,mergeable,statusCheckRollup | jq -r '.[] | select(.mergeable != "MERGEABLE" or .statusCheckRollup.[].conclusion != "SUCCESS") | "\(.number) \(.title)"'
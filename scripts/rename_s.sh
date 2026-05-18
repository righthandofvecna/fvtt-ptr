#/bin/bash

FILES=$(find . | grep -e ".*references/.*-s-")

for file in $FILES; do
    echo "Processing $file"
    # Replace the -s- with s-
    new_file=$(echo "$file" | sed -E 's/-s-/s-/')
    rm -f "$new_file" # Remove existing file if it exists
    mv "$file" "$new_file"
    echo "Renaming to $new_file"
done
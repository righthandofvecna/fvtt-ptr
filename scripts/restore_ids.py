"""
restore_ids.py

Scans all JSON files under packs/_source and compares the "_id" field to the
value stored at a reference git tag. Reports any file whose "_id" was changed
since that tag.

Usage:
  python scripts/restore_ids.py [--ref <git-ref>] [--fix]

Options:
  --ref <git-ref>   Reference git tag/commit to compare against (default: 4.4.3.37)
  --fix             Apply changes (overwrite the current "_id" with the reference value)
                    Without this flag the script runs in dry-run / report-only mode.
"""

import argparse
import json
import os
import subprocess
import sys


PACKS_SOURCE = os.path.join(os.path.dirname(__file__), "..", "packs", "_source")


def git_show(ref, repo_relative_path):
    """Return the file content at the given git ref, or None if it didn't exist."""
    result = subprocess.run(
        ["git", "show", f"{ref}:{repo_relative_path}"],
        cwd=os.path.dirname(__file__),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout


def get_repo_root():
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=os.path.dirname(__file__),
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(description="Detect and optionally restore incorrectly altered _id fields.")
    parser.add_argument("--ref", default="4.4.3.37", help="Git ref to use as reference (default: 4.4.3.37)")
    parser.add_argument("--fix", action="store_true", help="Apply changes (restore _id to reference value)")
    args = parser.parse_args()

    repo_root = get_repo_root()
    packs_source_abs = os.path.normpath(os.path.join(repo_root, "packs", "_source"))

    changed = []
    skipped_new = []

    for dirpath, dirnames, filenames in os.walk(packs_source_abs):
        for filename in sorted(filenames):
            if not filename.endswith(".json"):
                continue
            abs_path = os.path.join(dirpath, filename)
            # Path relative to repo root, using forward slashes for git show
            rel_path = os.path.relpath(abs_path, repo_root).replace(os.sep, "/")

            # Load the current file
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    current_data = json.load(f)
            except (json.JSONDecodeError, OSError) as e:
                print(f"WARNING: Could not read {rel_path}: {e}", file=sys.stderr)
                continue

            current_id = current_data.get("_id")
            if current_id is None:
                continue  # No _id field, skip

            # Get the file content at the reference tag
            ref_content = git_show(args.ref, rel_path)
            if ref_content is None:
                # File didn't exist at the reference tag — new file, skip
                skipped_new.append(rel_path)
                continue

            try:
                ref_data = json.loads(ref_content)
            except json.JSONDecodeError as e:
                print(f"WARNING: Could not parse {rel_path} at {args.ref}: {e}", file=sys.stderr)
                continue

            ref_id = ref_data.get("_id")
            if ref_id is None:
                continue  # No _id in reference, skip

            if current_id != ref_id:
                changed.append((rel_path, abs_path, ref_id, current_id))

    if not changed:
        print(f"No _id changes found between {args.ref} and the current working tree.")
        return

    print(f"Found {len(changed)} file(s) with altered _id (compared to {args.ref}):\n")
    for rel_path, abs_path, ref_id, current_id in changed:
        print(f"  {rel_path}")
        print(f"    reference ({args.ref}): {ref_id}")
        print(f"    current:               {current_id}")

    if args.fix:
        print(f"\nApplying fixes...")
        for rel_path, abs_path, ref_id, current_id in changed:
            with open(abs_path, "r", encoding="utf-8") as f:
                raw = f.read()
            # Reload to preserve formatting, then write back with corrected _id
            data = json.loads(raw)
            data["_id"] = ref_id
            # Preserve trailing newline if present
            trailing_newline = raw.endswith("\n")
            with open(abs_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                if trailing_newline:
                    f.write("\n")
            print(f"  Fixed: {rel_path}  ({current_id} -> {ref_id})")
        print("\nDone.")
    else:
        print(f"\nDry-run: no changes written. Re-run with --fix to apply.")

    if skipped_new:
        print(f"\n({len(skipped_new)} new file(s) not present at {args.ref} were skipped.)")


if __name__ == "__main__":
    main()

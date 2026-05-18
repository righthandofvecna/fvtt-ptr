
import re
import json
import os



UUID_RE = re.compile(r"@UUID\[Compendium\.ptu\.references\.Item\.(?P<id>[a-zA-Z0-9]+)\]\{(?P<name>[^\}]+)\}")

def slugify(name):
  return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def find_ids():
  with open(os.path.join(os.path.dirname(__file__), "..", "packs", "_source", "journals", "ptr-rulebook.json"), "r", encoding="utf-8") as f:
    content = f.read()

  slug_to_id = {}
  for match in UUID_RE.finditer(content):
    slug_to_id[slugify(match.group("name"))] = match.group("id")

  
  for slug, id in slug_to_id.items():
    try:
      with open(os.path.join(os.path.dirname(__file__), "..", "packs", "_source", "references", f"{slug}.json"), "r", encoding="utf-8") as f:
        data = json.load(f)
      if "_id" not in data or ("system" in data and "slug" in data["system"] and data["system"]["slug"] is None):
        print(f"Updating ID for {slug}: {id}")
        data["_id"] = id
        data["system"]["slug"] = slug
        with open(os.path.join(os.path.dirname(__file__), "..", "packs", "_source", "references", f"{slug}.json"), "w", encoding="utf-8") as f_out:
          json.dump(data, f_out, indent=2)
    except FileNotFoundError:
      print(f"Reference file for {slug} not found, skipping.")
  


  return slug_to_id


if __name__ == "__main__":
  name_to_id = find_ids()
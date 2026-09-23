#!/usr/bin/env python3
"""
region_tags_from_csv.py

Adds region tags to Pokémon species JSON files using PokeAPI's CSV source files
from GitHub (https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv).

A species gets a region tag for every regional Pokédex it appears in, meaning it
was obtainable in that region without trading from another game. For example,
Magikarp appears in nearly every regional Pokédex, so it gets most region tags.

Usage:
    python region_tags_from_csv.py [--dry-run] [--cache-dir DIR] [--force-refresh]
                                   [--limit N] [--species-dir DIR]
"""

import json
import os
import csv
import io
import argparse
import urllib.request
import urllib.error
import time
from pathlib import Path
from collections import defaultdict

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GITHUB_CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
DEFAULT_CACHE_DIR = os.path.join(os.path.dirname(__file__), ".pokeapi_csv_cache")
DEFAULT_SPECIES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "packs", "_source", "species"
)

# Map PokeAPI pokedex identifiers → region tag name.
# Entries not listed here (e.g. 'national', 'conquest-gallery') are ignored.
POKEDEX_TO_REGION = {
    # Kanto
    "kanto":               "Kanto",
    "original-kanto":      "Kanto",
    "updated-kanto":       "Kanto",
    "letsgo-kanto":        "Kanto",
    # Johto
    "johto":               "Johto",
    "original-johto":      "Johto",
    "updated-johto":       "Johto",
    # Hoenn
    "hoenn":               "Hoenn",
    "original-hoenn":      "Hoenn",
    "updated-hoenn":       "Hoenn",
    "extended-hoenn":      "Hoenn",
    # Sinnoh
    "sinnoh":              "Sinnoh",
    "original-sinnoh":     "Sinnoh",
    "extended-sinnoh":     "Sinnoh",
    # Hisui (Sinnoh prequel)
    "hisui":               "Hisui",
    # Unova
    "unova":               "Unova",
    "original-unova":      "Unova",
    "updated-unova":       "Unova",
    # Kalos
    "kalos-central":       "Kalos",
    "kalos-coastal":       "Kalos",
    "kalos-mountain":      "Kalos",
    # Alola
    "alola":               "Alola",
    "original-alola":      "Alola",
    "updated-alola":       "Alola",
    "melemele":            "Alola",
    "akala":               "Alola",
    "ulaula":              "Alola",
    "poni":                "Alola",
    # Galar
    "galar":               "Galar",
    "isle-of-armor":       "Galar",
    "crown-tundra":        "Galar",
    # Paldea
    "paldea":              "Paldea",
    "kitakami":            "Paldea",
    "blueberry":           "Paldea",
}

# ---------------------------------------------------------------------------
# CSV fetching
# ---------------------------------------------------------------------------

def fetch_csv(filename: str, cache_dir: str, force_refresh: bool = False) -> list[dict]:
    """Download a CSV file from PokeAPI's GitHub with disk caching."""
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, filename)

    if os.path.exists(cache_file) and not force_refresh:
        with open(cache_file, "r", encoding="utf-8") as f:
            return list(csv.DictReader(f))

    url = f"{GITHUB_CSV_BASE}/{filename}"
    print(f"  Downloading {url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "fvtt-ptr-region-tagger/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Failed to download {filename}: {e}") from e

    with open(cache_file, "w", encoding="utf-8") as f:
        f.write(content)

    return list(csv.DictReader(io.StringIO(content)))

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def build_species_to_regions(cache_dir: str, force_refresh: bool = False) -> dict[int, set[str]]:
    """
    Returns a mapping of {national_dex_number: set_of_region_tags}.

    Uses pokemon_dex_numbers.csv (which Pokémon appear in which Pokédex)
    and pokedexes.csv (which Pokédex identifier → region).
    """
    print("Loading PokeAPI CSV data...")

    # pokedexes.csv: id, region_id, identifier
    pokedexes_rows = fetch_csv("pokedexes.csv", cache_dir, force_refresh)
    # Build: pokedex_id (str) → region_tag (str or None)
    pokedex_id_to_region: dict[str, str | None] = {}
    for row in pokedexes_rows:
        dex_id = row["id"]
        identifier = row["identifier"].lower()
        region_tag = POKEDEX_TO_REGION.get(identifier)
        pokedex_id_to_region[dex_id] = region_tag

    # pokemon_dex_numbers.csv: species_id, pokedex_id, pokedex_number
    dex_numbers_rows = fetch_csv("pokemon_dex_numbers.csv", cache_dir, force_refresh)

    species_to_regions: dict[int, set[str]] = defaultdict(set)
    for row in dex_numbers_rows:
        species_id = int(row["species_id"])
        pokedex_id = row["pokedex_id"]
        region_tag = pokedex_id_to_region.get(pokedex_id)
        if region_tag:
            species_to_regions[species_id].add(region_tag)

    print(f"  Loaded region data for {len(species_to_regions)} species.")
    return dict(species_to_regions)


def build_species_metadata(cache_dir: str, force_refresh: bool = False) -> dict[int, dict]:
    """
    Returns {national_dex_number: {is_legendary, is_mythical}} from pokemon_species.csv.
    """
    rows = fetch_csv("pokemon_species.csv", cache_dir, force_refresh)
    result = {}
    for row in rows:
        sid = int(row["id"])
        result[sid] = {
            "is_legendary": row.get("is_legendary", "0") == "1",
            "is_mythical": row.get("is_mythical", "0") == "1",
        }
    return result

# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------

def process_species_file(
    path: str,
    species_to_regions: dict[int, set[str]],
    species_metadata: dict[int, dict],
    dry_run: bool,
) -> bool:
    """Process a single species JSON file. Returns True if modified."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    system = data.get("system", {})
    if not system:
        return False

    dex_number = system.get("number")
    if not dex_number:
        return False

    try:
        dex_number = int(dex_number)
    except (TypeError, ValueError):
        return False

    # Current keywords
    existing = set(system.get("keywords") or [])

    # Region tags from Pokédex data
    new_regions = species_to_regions.get(dex_number, set())

    # Legendary / Mythical from CSV
    meta = species_metadata.get(dex_number, {})
    additional = set()
    if meta.get("is_legendary") or meta.get("is_mythical"):
        additional.add("Legendary")

    # Merge: keep existing non-region tags, replace region tags with CSV data
    all_region_tags = set(POKEDEX_TO_REGION.values())
    non_region_existing = {k for k in existing if k not in all_region_tags and k != "Legendary"}

    new_keywords = non_region_existing | new_regions | additional

    if new_keywords == existing:
        return False

    added = new_keywords - existing
    removed = existing - new_keywords

    print(
        f"  {os.path.basename(path)} (#{dex_number}): "
        f"+{sorted(added)} -{sorted(removed)}"
    )

    if not dry_run:
        system["keywords"] = sorted(new_keywords)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Add region tags to species JSON files using PokeAPI CSV data from GitHub."
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write files.")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of files processed (0 = all).")
    parser.add_argument("--cache-dir", default=DEFAULT_CACHE_DIR, help="CSV cache directory.")
    parser.add_argument("--force-refresh", action="store_true", help="Force re-download of CSV files.")
    parser.add_argument("--species-dir", default=DEFAULT_SPECIES_DIR, help="Path to species JSON source directory.")
    args = parser.parse_args()

    species_to_regions = build_species_to_regions(args.cache_dir, args.force_refresh)
    species_metadata = build_species_metadata(args.cache_dir, args.force_refresh)

    species_dir = Path(args.species_dir)
    if not species_dir.exists():
        raise FileNotFoundError(f"Species directory not found: {species_dir}")

    processed = 0
    modified = 0

    for path in sorted(species_dir.rglob("*.json")):
        if path.name == "_folder.json":
            continue
        if args.limit and processed >= args.limit:
            break
        processed += 1
        if process_species_file(str(path), species_to_regions, species_metadata, args.dry_run):
            modified += 1

    print(
        f"\nDone. Processed {processed} files, modified {modified}"
        + (" (dry run)" if args.dry_run else "") + "."
    )


if __name__ == "__main__":
    main()

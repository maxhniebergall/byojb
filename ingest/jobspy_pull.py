#!/usr/bin/env python3
"""
JobSpy broad-board ingestion for career-ops  (NEW component).

Two modes:
  --refresh : scrape the boards configured in config/jobspy.yml (LinkedIn, Indeed,
              Glassdoor, ZipRecruiter, Google) and write the normalized results to
              data/jobspy-cache.json. This is the slow, network-bound step — run it
              on its own cadence (manually or via cron), NOT inside the scanner.
  --emit    : print the cached jobs as jobs-json-v1 to stdout (sub-second). This is
              what the "JobSpy Boards" local-parser entry in portals.yml calls, so it
              stays well under scan.mjs's ~20s parser timeout. (default mode)

Output contract for --emit (consumed by providers/local-parser.mjs):
  {"jobs": [{"title": str, "url": str, "company": str, "location": str}, ...]}

All diagnostics go to stderr so stdout stays pure JSON.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config" / "jobspy.yml"
DEFAULT_CACHE = ROOT / "data" / "jobspy-cache.json"


def log(*args):
    print(*args, file=sys.stderr, flush=True)


def load_config(path: Path) -> dict:
    import yaml
    # Fall back to the committed template on a fresh clone where the live config
    # hasn't been created yet.
    if not path.exists():
        example = path.with_suffix(".example.yml")
        if example.exists():
            log(f"NOTE: {path} not found; using {example}. Copy it to {path.name} and edit.")
            path = example
    with open(path, "r", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh) or {}
    return cfg


def _clean(value) -> str:
    """NaN / None / floats → trimmed string."""
    if value is None:
        return ""
    try:
        import math
        if isinstance(value, float) and math.isnan(value):
            return ""
    except Exception:
        pass
    return str(value).strip()


def refresh(config_path: Path, cache_path: Path) -> int:
    from jobspy import scrape_jobs

    cfg = load_config(config_path)
    sites = cfg.get("sites") or ["indeed"]
    search_terms = [t for t in (cfg.get("search_terms") or []) if t and "[FILL IN]" not in t]
    locations = cfg.get("locations") or ["Remote"]
    results_wanted = int(cfg.get("results_wanted", 25))
    hours_old = cfg.get("hours_old")
    country_indeed = cfg.get("country_indeed", "USA")
    is_remote = bool(cfg.get("is_remote", False))
    distance = cfg.get("distance", 50)

    if not search_terms:
        log("ERROR: no usable search_terms in config (did you replace the [FILL IN] placeholder?)")
        return 2

    seen_urls = set()
    jobs = []
    # Loop per site so one board failing (rate-limit, etc.) doesn't kill the rest.
    for term in search_terms:
        for location in locations:
            for site in sites:
                log(f"  scraping {site!r} for {term!r} @ {location!r} ...")
                try:
                    df = scrape_jobs(
                        site_name=[site],
                        search_term=term,
                        location=location,
                        results_wanted=results_wanted,
                        hours_old=hours_old,
                        country_indeed=country_indeed,
                        is_remote=is_remote,
                        distance=distance,
                        verbose=0,
                    )
                except Exception as exc:  # noqa: BLE001 — one board's failure is non-fatal
                    log(f"    ! {site} failed: {exc}")
                    continue
                if df is None or len(df) == 0:
                    log(f"    {site}: 0 results")
                    continue
                added = 0
                for _, row in df.iterrows():
                    url = _clean(row.get("job_url") or row.get("job_url_direct"))
                    title = _clean(row.get("title"))
                    if not url or not title or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    jobs.append({
                        "title": title,
                        "url": url,
                        "company": _clean(row.get("company")),
                        "location": _clean(row.get("location")),
                        "source_site": site,
                        "date_posted": _clean(row.get("date_posted")),
                    })
                    added += 1
                log(f"    {site}: +{added} new")

    cache = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(jobs),
        "config": {"sites": sites, "search_terms": search_terms, "locations": locations},
        "jobs": jobs,
    }
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, indent=2, ensure_ascii=False)
    log(f"\n✓ wrote {len(jobs)} jobs to {cache_path}")
    return 0


def emit(cache_path: Path) -> int:
    """Print cached jobs as jobs-json-v1. Missing/empty cache → empty list (never crash the scan)."""
    if not cache_path.exists():
        log(f"WARNING: {cache_path} not found — run `--refresh` first. Emitting 0 jobs.")
        print(json.dumps({"jobs": []}))
        return 0
    with open(cache_path, "r", encoding="utf-8") as fh:
        cache = json.load(fh)
    jobs = [
        {"title": j["title"], "url": j["url"], "company": j.get("company", ""), "location": j.get("location", "")}
        for j in cache.get("jobs", [])
        if j.get("title") and j.get("url")
    ]
    print(json.dumps({"jobs": jobs}, ensure_ascii=False))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="JobSpy ingestion for career-ops")
    group = ap.add_mutually_exclusive_group()
    group.add_argument("--refresh", action="store_true", help="scrape boards → cache (slow)")
    group.add_argument("--emit", action="store_true", help="print cached jobs as JSON (fast, default)")
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    ap.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = ap.parse_args()

    if args.refresh:
        return refresh(args.config, args.cache)
    return emit(args.cache)


if __name__ == "__main__":
    sys.exit(main())

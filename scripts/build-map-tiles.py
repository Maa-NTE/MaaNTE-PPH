import argparse
import hashlib
import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parents[1]
Image.MAX_IMAGE_PIXELS = None


def parse_args():
    parser = argparse.ArgumentParser(description="Build Leaflet map tiles from source map images.")
    parser.add_argument("--source-dir", default="maps-source")
    parser.add_argument("--output-dir", default="public/map-tiles")
    parser.add_argument("--tile-size", type=int, default=256)
    parser.add_argument("--min-zoom", type=int, default=-8)
    parser.add_argument("--max-zoom", type=int, default=0)
    parser.add_argument("--format", choices=("webp", "png"), default="webp")
    parser.add_argument("--webp-quality", type=int, default=92)
    parser.add_argument("--webp-method", type=int, default=0)
    parser.add_argument("--webp-lossless", action="store_true")
    return parser.parse_args()


def run_node_metadata():
    script = (
        "import { MAP_LAYERS } from './src/data/layers.js';"
        "console.log(JSON.stringify(MAP_LAYERS"
        ".filter((layer) => layer.imageUrl)"
        ".map((layer) => ({ id: layer.id, imageUrl: layer.imageUrl, "
        "width: layer.image.width, height: layer.image.height }))));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=PROJECT_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def resolve_inside_project(path):
    resolved = (PROJECT_ROOT / path).resolve()
    if PROJECT_ROOT not in resolved.parents and resolved != PROJECT_ROOT:
        raise ValueError(f"Refusing to write outside project root: {resolved}")
    return resolved


def get_source_path(layer, source_dir):
    file_name = Path(layer["imageUrl"]).name
    source_path = source_dir / file_name
    if source_path.exists():
        return source_path
    fallback_path = PROJECT_ROOT / "public" / "maps" / file_name
    if fallback_path.exists():
        return fallback_path
    raise FileNotFoundError(f"Missing source map image: {file_name}")


def save_tile(tile, path, image_format, webp_quality, webp_method, webp_lossless):
    path.parent.mkdir(parents=True, exist_ok=True)
    if image_format == "png":
        tile.save(path, "PNG", optimize=True)
        return
    tile.save(
        path,
        "WEBP",
        quality=webp_quality,
        method=webp_method,
        lossless=webp_lossless,
        exact=True,
    )


def build_layer_tiles(layer, source_path, output_dir, args):
    tile_count = 0
    suffix = "webp" if args.format == "webp" else "png"

    with Image.open(source_path) as opened:
      image = opened.convert("RGBA")

      for zoom in range(args.min_zoom, args.max_zoom + 1):
          scale = 2 ** zoom
          scaled_width = max(1, math.ceil(image.width * scale))
          scaled_height = max(1, math.ceil(image.height * scale))
          if zoom == 0:
              scaled = image
          else:
              scaled = image.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)

          columns = math.ceil(scaled_width / args.tile_size)
          rows = math.ceil(scaled_height / args.tile_size)
          zoom_dir = output_dir / layer["id"] / str(zoom)

          for tile_y in range(rows):
              for tile_x in range(columns):
                  left = tile_x * args.tile_size
                  top = tile_y * args.tile_size
                  right = min(left + args.tile_size, scaled_width)
                  bottom = min(top + args.tile_size, scaled_height)
                  crop = scaled.crop((left, top, right, bottom))
                  if crop.size != (args.tile_size, args.tile_size):
                      padded = Image.new("RGBA", (args.tile_size, args.tile_size), (0, 0, 0, 0))
                      padded.alpha_composite(crop, (0, 0))
                      crop = padded

                  save_tile(
                      crop,
                      zoom_dir / str(tile_x) / f"{tile_y}.{suffix}",
                      args.format,
                      args.webp_quality,
                      args.webp_method,
                      args.webp_lossless,
                  )
                  tile_count += 1

          if scaled is not image:
              scaled.close()

    return tile_count


def main():
    args = parse_args()
    source_dir = resolve_inside_project(args.source_dir)
    output_dir = resolve_inside_project(args.output_dir)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    layers = run_node_metadata()
    signatures = [
        f"tileSize={args.tile_size}",
        f"minZoom={args.min_zoom}",
        f"maxZoom={args.max_zoom}",
        f"format={args.format}",
        f"webpQuality={args.webp_quality}",
        f"webpMethod={args.webp_method}",
        f"webpLossless={args.webp_lossless}",
    ]
    total_tiles = 0

    for layer in layers:
        print(f"Tiling {layer['id']}...", flush=True)
        source_path = get_source_path(layer, source_dir)
        stat = source_path.stat()
        signatures.append(f"{layer['id']}:{source_path.name}:{stat.st_size}:{int(stat.st_mtime_ns)}")
        total_tiles += build_layer_tiles(layer, source_path, output_dir, args)

    version = hashlib.sha1("|".join(signatures).encode("utf-8")).hexdigest()[:12]
    manifest = {
        "version": version,
        "tileSize": args.tile_size,
        "minZoom": args.min_zoom,
        "maxZoom": args.max_zoom,
        "tileFormat": args.format,
        "webpQuality": args.webp_quality if args.format == "webp" else None,
        "webpMethod": args.webp_method if args.format == "webp" else None,
        "webpLossless": args.webp_lossless if args.format == "webp" else None,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "layers": [layer["id"] for layer in layers],
        "totalTiles": total_tiles,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {total_tiles} map tiles in {args.output_dir}")


if __name__ == "__main__":
    main()

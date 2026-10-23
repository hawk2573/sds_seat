#!/usr/bin/env python3
"""Render the reviewed source and proposed geometry without writing to Airtable."""
import base64
import html
import json
from pathlib import Path


def render(draft_path, output_path):
    draft = json.loads(draft_path.read_text())
    source = (draft_path.parent / draft["sourceImage"]).resolve()
    image = base64.b64encode(source.read_bytes()).decode("ascii")
    width, height = draft["sourceWidth"], draft["sourceHeight"]
    scale = 1120 / width
    map_x = lambda x: 40 + x * width * scale
    map_y = lambda y: 145 + y * height * scale
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1600" height="1600" viewBox="0 0 1200 1200">',
        '<title>Kaplan Level 2: proposed zones and workstation locations</title>',
        '<desc>Four owner-proposed zones on the existing floor plan. Fifty MDes workstations follow printed labels. Fourteen PhD workstations have proposed, unverified positions along the right side. Faculty and PhD boundaries overlap at the lower right.</desc>',
        '<rect width="1200" height="1200" fill="white"/>',
        '<g font-family="DejaVu Sans, sans-serif" fill="#1b2d38">',
        '<text x="40" y="46" font-size="26" font-weight="bold">Kaplan Level 2 · zone layout review</text>',
        '<text x="40" y="77" font-size="16">Draft · September 7, 2026 · proposed zones over the 2018 reference drawing</text>',
    ]
    for x, name, color in [(40, "Shared & Administrative", "#238b45"), (385, "MDes", "#c93639"), (580, "Faculty", "#b58b08"), (775, "PhD", "#a938be")]:
        svg.extend([
            f'<rect x="{x}" y="102" width="18" height="12" fill="{color}" fill-opacity="0.2" stroke="{color}"/>',
            f'<text x="{x + 28}" y="115" font-size="15">{html.escape(name)}</text>',
        ])
    svg.append(f'<image x="40" y="145" width="1120" height="{height * scale:.2f}" xlink:href="data:image/png;base64,{image}"/>')
    for zone in draft["zones"]:
        points = " ".join(f'{map_x(p["x"]):.2f},{map_y(p["y"]):.2f}' for p in zone["points"])
        svg.append(f'<polygon points="{points}" fill="{zone["color"]}" fill-opacity="0.09" stroke="{zone["color"]}" stroke-width="1.8"/>')
    for desk in draft["workstations"]:
        x, y, w, h = map_x(desk["x"]), map_y(desk["y"]), desk["width"] * width * scale, desk["height"] * height * scale
        proposed = desk["zone"] == "phd"
        color = "#a938be" if proposed else "#c93639"
        fill = "#f6e4fa" if proposed else "#c93639"
        opacity = "1" if proposed else "0.13"
        dash = ' stroke-dasharray="2 1"' if proposed else ""
        svg.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="1" fill="{fill}" fill-opacity="{opacity}" stroke="{color}" stroke-width="0.6"{dash}><title>{html.escape(desk["name"] + ": " + desk["positionSource"])}</title></rect>')
        if proposed:
            svg.append(f'<text x="{x + w / 2:.2f}" y="{y + h / 2 + 2.2:.2f}" font-size="8" text-anchor="middle" fill="#592765">{desk["label"]}</text>')
    labels = {"shared-administrative": ("Shared & Administrative", 153), "mdes": ("MDes", 48), "faculty": ("Faculty", 58), "phd": ("PhD", 42)}
    for zone in draft["zones"]:
        label, box_width = labels[zone["key"]]
        x, y = map_x(zone["label"]["x"]), map_y(zone["label"]["y"])
        box_width *= scale
        svg.extend([
            f'<rect x="{x - box_width / 2:.2f}" y="{y - 13:.2f}" width="{box_width}" height="21" rx="3" fill="white" fill-opacity="0.94"/>',
            f'<text x="{x:.2f}" y="{y:.2f}" font-size="12" font-weight="bold" text-anchor="middle" fill="{zone["color"]}">{html.escape(label)}</text>',
        ])
    svg.extend([
        '<text x="40" y="1060" font-size="16" font-weight="bold">50 MDes records at printed labels · 14 PhD records in proposed positions</text>',
        '<text x="40" y="1091" font-size="15">Dashed PhD desk markers are schematic. Confirm placement, numbering and circulation on site.</text>',
        '<text x="40" y="1118" font-size="15">Existing furniture underneath is an older reference. Faculty assignments have not been inferred.</text>',
        '<text x="40" y="1145" font-size="14" fill="#536570">Every workstation appears once. This draft has not been saved to Airtable.</text>',
        '</g></svg>',
    ])
    output_path.write_text("\n".join(svg) + "\n")


if __name__ == "__main__":
    repo = Path(__file__).resolve().parents[1]
    draft_path = repo / "docs/floor-plan-pilot/zone-layout-draft.json"
    output_path = draft_path.with_suffix(".svg")
    render(draft_path, output_path)
    print(output_path)

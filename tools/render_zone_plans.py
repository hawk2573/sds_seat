#!/usr/bin/env python3
"""Build independent, schematic zone plans and their Airtable coordinate manifests.

Requires Python 3 and system librsvg/Cairo libraries. No Airtable writes occur here.
The old drawing supplies room positions and numbering. A simplified vector
tracing retains connected rooms, circulation, stairs and furniture.
"""
import argparse
import html
import json
import subprocess
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED
from pathlib import Path
from render_svg_artifact import render_svg
from kaplan_reference_layout import draw_reference

ROOT = Path(__file__).resolve().parents[1]
INK = "#22363e"
MUTED = "#65777c"
COLORS = {"mdes": "#b64c58", "faculty": "#a47b1c", "phd": "#8155a2", "shared-administrative": "#318368"}
PALE = {"mdes": "#fcf2f2", "faculty": "#fcf8e9", "phd": "#f6f1fa", "shared-administrative": "#eef7f2"}
# Existing records in the pilot base; regeneration must retain these links.
FLOOR_PLAN_RECORD_IDS = {
    "mdes": "reczg3WErH2SXW44D",
    "faculty": "recPQVQAJu0sV36ta",
    "phd": "rechmO5RMbvv8LCKr",
    "shared-administrative": "recytZCyzHuJyoY2d",
}


class Sheet:
    def __init__(self, key, title, subtitle, draft, landscape=False):
        self.key = key
        self.draft = draft
        self.width, self.height = (1140, 880) if landscape else (880, 1140)
        self.color = COLORS[key]
        self.linked = {int(d["label"]): d for d in draft["workstations"] if d["zone"] == key}
        self.desks = []
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.width}" height="{self.height}" viewBox="0 0 {self.width} {self.height}">',
                      f'<title>{html.escape(title)} - Kaplan Level 2</title>',
                      '<desc>Simplified floor plan with source room outlines, circulation and furniture. Desk locations require on-site confirmation. Dashed desks have no linked inventory record.</desc>']
        self.rect(0, 0, self.width, self.height, "white")
        self.rect(44, 42, 40, 5, self.color)
        self.text(44, 71, "KAPLAN / LEVEL 2", 14, MUTED, 700)
        for i, line in enumerate(title.split("\n")):
            self.text(44, 111 + i * 36, line, 34, INK, 700)
        self.text(44, 153 if "\n" not in title else 180, subtitle, 15, MUTED)
        self.locator(self.width - 194, 42)
        self.line(44, 200 if "\n" in title else 181, self.width - 44, 200 if "\n" in title else 181, "#d9e2e2")

    def rect(self, x, y, w, h, fill="none", stroke="none", radius=0, dash=False, stroke_width=1.4):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}"' + (' stroke-dasharray="5 4"' if dash else '') + '/>')

    def text(self, x, y, value, size=16, color=INK, weight=400, anchor="start"):
        self.parts.append(f'<text x="{x}" y="{y}" font-family="DejaVu Sans, sans-serif" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{color}">{html.escape(str(value))}</text>')

    def line(self, x1, y1, x2, y2, color="#c8d6d7", dash=False):
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1.4"' + (' stroke-dasharray="5 5"' if dash else '') + '/>')

    def landmark(self, x, y, w, h, lines):
        self.rect(x, y, w, h, "#f2f5f5", "#dce5e5", 12)
        for i, label in enumerate(lines):
            self.text(x + 16, y + 29 + i * 22, label, 15, MUTED)

    def locator(self, x, y):
        self.text(x, y + 3, "ON THIS FLOOR", 11, MUTED, 700)
        scale = 150 / 848
        self.rect(x, y + 16, 150, 462 * scale, "#f3f6f6", "#aebec3", 2)
        for zone in self.draft["zones"]:
            points = " ".join(f"{x + (p['x'] * 959 - 64) * scale},{y + 16 + (p['y'] * 719 - 153) * scale}" for p in zone["points"])
            fill = COLORS[zone["key"]] if zone["key"] == self.key else PALE[zone["key"]]
            self.parts.append(f'<polygon points="{points}" fill="{fill}"/>')
        self.text(x, y + 124, "Same orientation as source", 10, MUTED)

    def footer(self, notes):
        y = self.height - 111
        self.line(44, y, self.width - 44, y)
        self.rect(44, y + 18, 26, 15, "white", self.color, 3)
        self.text(80, y + 31, "Linked workstation", 12)
        self.rect(263, y + 18, 26, 15, "white", "#849397", 3, True)
        self.text(299, y + 31, "Source desk / inventory to check", 12)
        for i, note in enumerate(notes):
            self.text(44, y + 57 + i * 19, note, 12, MUTED)
        self.text(self.width - 44, self.height - 22, "SOURCE LAYOUT / DRAFT 02", 10, MUTED, 700, "end")

    def save(self, folder):
        path = folder / f"{self.key}.svg"
        path.write_text("\n".join(self.parts + ["</svg>"]) + "\n")
        return path


CROPS = {
    "mdes": (58, 145, 432, 480),
    "faculty": (245, 380, 673, 245),
    "phd": (590, 145, 328, 480),
    "shared-administrative": (198, 145, 656, 420),
}


def source_desks():
    """Read the 102 original numbered positions directly from the source PDF."""
    pdf = ROOT / "assets/floor-plans/Kaplan Numbered Floor Plan.pdf"
    xml = subprocess.check_output(["pdftotext", "-bbox", str(pdf), "-"], text=True)
    result = {key: {} for key in ("mdes", "faculty", "shared-administrative")}
    for word in ET.fromstring(xml).iter():
        text = word.text or ""
        if not word.tag.endswith("word") or not text.isdigit():
            continue
        number = int(text)
        x, y = float(word.attrib["xMin"]), float(word.attrib["yMin"])
        cx = (x + float(word.attrib["xMax"])) / 2
        cy = (y + float(word.attrib["yMax"])) / 2
        key = "mdes" if 70 < x < 130 and 180 < y < 590 and 1 <= number <= 72 else \
              "faculty" if 520 < x < 830 and 565 < y < 605 and 1 <= number <= 20 else \
              "shared-administrative" if 540 < x < 585 and 275 < y < 380 and 1 <= number <= 10 else None
        if key:
            assert number not in result[key], (key, number)
            result[key][number] = (cx, cy)
    assert [len(result[k]) for k in result] == [72, 20, 10]
    return result


class SourceMap:
    def __init__(self, sheet, crop):
        self.sheet, self.key, self.crop = sheet, sheet.key, crop
        self.scale = min((sheet.width - 88) / crop[2], (sheet.height - 350) / crop[3])
        self.left = (sheet.width - crop[2] * self.scale) / 2
        self.top = 210 + (sheet.height - 350 - crop[3] * self.scale) / 2
        self.sheet.parts.append(f'<defs><clipPath id="map-clip"><rect x="{self.left}" y="{self.top}" width="{crop[2] * self.scale}" height="{crop[3] * self.scale}"/></clipPath></defs><g clip-path="url(#map-clip)">')

    def x(self, value):
        return self.left + (value - self.crop[0]) * self.scale

    def y(self, value):
        return self.top + (value - self.crop[1]) * self.scale

    def rect(self, x, y, w, h, fill="none", stroke="none", weight=.8, radius=0, dash=False):
        self.sheet.rect(self.x(x), self.y(y), w * self.scale, h * self.scale, fill, stroke, radius * self.scale, dash, weight * self.scale)

    def line(self, x1, y1, x2, y2, color="#9aadb5", weight=.8, dash=False):
        self.sheet.parts.append(f'<line x1="{self.x(x1)}" y1="{self.y(y1)}" x2="{self.x(x2)}" y2="{self.y(y2)}" stroke="{color}" stroke-width="{weight * self.scale}"' + (' stroke-dasharray="6 4"' if dash else '') + '/>')

    def label(self, x, y, lines, size=8, color="#617780", knockout=False, rotation=0):
        # A crop may cut through a neighboring room, but never through its name.
        label_width = max(len(line) for line in lines) * size * .7
        label_height = len(lines) * size * 1.25
        if rotation:
            label_width, label_height = label_height, label_width
        if (x - label_width / 2 < self.crop[0] + 1 or x + label_width / 2 > self.crop[0] + self.crop[2] - 1
                or y - label_height / 2 < self.crop[1] + 1 or y + label_height / 2 > self.crop[1] + self.crop[3] - 1):
            return
        if knockout:
            width = max(len(line) for line in lines) * size * .65 + 6
            self.rect(x - width / 2, y - size * .65, width, len(lines) * size * 1.25 + 2, "#fff")
        if rotation:
            self.sheet.parts.append(f'<g transform="rotate({rotation} {self.x(x)} {self.y(y)})">')
        for i, text in enumerate(lines):
            self.sheet.text(self.x(x), self.y(y + i * size * 1.22 + size * .35), text, size * self.scale, color, 500, "middle")
        if rotation:
            self.sheet.parts.append('</g>')

    def circle(self, x, y, radius, fill="#fff", stroke="#afbec4", weight=.55):
        self.sheet.parts.append(f'<circle cx="{self.x(x)}" cy="{self.y(y)}" r="{radius * self.scale}" fill="{fill}" stroke="{stroke}" stroke-width="{weight * self.scale}"/>')

    def table(self, x, y, w, h, seats=4):
        self.rect(x - w / 2, y - h / 2, w, h, "#eff3f4", "#aabac1", .55, 1)
        for i in range(seats // 2):
            chair_x = x - w / 2 + (i + .5) * w / max(seats // 2, 1)
            for chair_y in (y - h / 2 - 2.5, y + h / 2 + 2.5):
                self.rect(chair_x - 1.5, chair_y - .8, 3, 1.6, "#fff", "#b5c3c8", .4, .5)

    def round_table(self, x, y, radius):
        self.circle(x, y, radius, "#f2f6f7")
        for dx, dy in [(0, -radius - 3), (0, radius + 3), (-radius - 3, 0), (radius + 3, 0)]:
            self.circle(x + dx, y + dy, 1.4)

    def stair(self, x, y, w, h):
        self.rect(x, y, w, h, "#eef3f4", "#a3b4bc", .7)
        for step in range(1, int(h / 5)):
            self.line(x, y + step * 5, x + w, y + step * 5, "#b4c2c8", .5)
        self.line(x + w * .5, y + 5, x + w * .5, y + h - 5, "#96aab3", .7)

    def door(self, x, y, side):
        if side == "left":
            self.line(x, y - 8, x, y, "#fff", 2.3)
            self.line(x, y, x + 8, y - 3, "#9bafb7", .6)
        else:
            self.line(x - 8, y, x, y, "#fff", 2.3)
            self.line(x, y, x - 3, y - 8 if side == "bottom" else y + 8, "#9bafb7", .6)

    def zone_points(self):
        zone = next(z for z in self.sheet.draft["zones"] if z["key"] == self.key)
        return " ".join(f"{self.x(p['x'] * 959)},{self.y(p['y'] * 719)}" for p in zone["points"])

    def zone_fill(self):
        self.sheet.parts.append(f'<polygon points="{self.zone_points()}" fill="{PALE[self.key]}"/>')

    def zone_outline(self):
        self.sheet.parts.append(f'<polygon points="{self.zone_points()}" fill="none" stroke="{COLORS[self.key]}" stroke-width="{.8 * self.scale}" stroke-dasharray="6 4"/>')

    def desk(self, key, number, cx, cy, w, h, context=False):
        linked = self.sheet.linked.get(number) if key == self.key else None
        stroke = "#b7c4c9" if context else COLORS[key] if linked else "#6c7f87"
        self.rect(cx - w / 2, cy - h / 2, w, h, "#fff", stroke, .8 if not context else .5, .9, not linked and not context)
        # Keep chairs compact so neighboring source desk groups remain distinct.
        self.rect(cx - 2.3, cy + h / 2 + 1.2, 4.6, 1.8, "#fff", "#afbec5", .45, .5)
        self.label(cx, cy - .4, [str(number)], 7.1 if key == "faculty" else 8, "#9dabb1" if context else INK)
        if context:
            return
        prefix = {"mdes": "", "faculty": "F", "phd": "P", "shared-administrative": "S"}[key]
        self.sheet.desks.append({"label": f"{prefix}{number:02}", "displayLabel": str(number), "sourceNumber": number,
            "spaceRecordId": linked["spaceRecordId"] if linked else None, "spaceId": linked["spaceId"] if linked else None,
            "name": linked["name"] if linked else f"Source-plan {key} desk {number}",
            "positionStatus": "proposed" if key == "phd" else "source-label-position",
            "inventoryStatus": "existing-record" if linked else "reference-only", "type": "rectangle",
            "x": round(self.x(cx - w / 2) / self.sheet.width, 8), "y": round(self.y(cy - h / 2) / self.sheet.height, 8),
            "width": round(w * self.scale / self.sheet.width, 8), "height": round(h * self.scale / self.sheet.height, 8),
            "rotation": 0, "sourceCenter": {"x": round(cx, 5), "y": round(cy, 5)}})

    def close(self):
        self.sheet.parts.append('</g>')


def zone_sheet(key, draft, positions):
    titles = {"mdes": "MDes workspaces", "faculty": "Faculty workspaces", "phd": "PhD workspaces", "shared-administrative": "Public & administrative"}
    subtitles = {"mdes": "Left side / original pods, aisle and adjoining flex rooms",
                 "faculty": "Bottom edge / work rooms, lounge and perimeter desks",
                 "phd": "Right side / room boundaries with proposed desk locations",
                 "shared-administrative": "Shared core / gallery, meeting rooms, staff desks and amenities"}
    sheet = Sheet(key, titles[key], subtitles[key], draft, key in ("faculty", "shared-administrative"))
    m = SourceMap(sheet, CROPS[key])
    draw_reference(m)
    for desk_key, desks in positions.items():
        for number, (cx, cy) in sorted(desks.items()):
            w, h = (10.8, 12) if desk_key == "faculty" else (15.5, 10.5) if desk_key == "shared-administrative" else (14, 10.5)
            m.desk(desk_key, number, cx, cy, w, h, context=desk_key != key)
    if key == "phd":
        for desk in draft["workstations"]:
            if desk["zone"] == key:
                m.desk(key, int(desk["label"]), (desk["x"] + desk["width"] / 2) * 959, (desk["y"] + desk["height"] / 2) * 719, 14, 12)
    m.close()
    notes = {
        "mdes": ["72 numbered desks retained / 50 linked records / 22 source desks to check.", "Room outlines and circulation follow the older plan. Confirm current layout on site."],
        "faculty": ["All 20 numbered perimeter desks retained. Current faculty inventory needs checking.", "The lower work / flex rooms retain their source footprints and furniture context."],
        "phd": ["14 existing records (7-20) / desk positions remain proposed and need on-site confirmation.", "Room outlines follow the older plan; loose furniture in the proposed desk strip is omitted."],
        "shared-administrative": ["All 10 numbered staff desks retained as reference inventory to check.", "Connected room outlines, stairs, circulation and kitchen follow the older plan."],
    }
    sheet.footer(notes[key])
    return sheet


def build(render=False, pdf=False):
    draft = json.loads((ROOT / "docs/floor-plan-pilot/zone-layout-draft.json").read_text())
    folder = ROOT / "assets/floor-plans/zones"
    folder.mkdir(parents=True, exist_ok=True)
    positions = source_desks()
    plans = []
    for sheet in [zone_sheet(key, draft, positions) for key in CROPS]:
        svg_path = sheet.save(folder)
        zone = next(z for z in draft["zones"] if z["key"] == sheet.key)
        entry = {"key": sheet.key, "name": {"mdes": "MDes", "faculty": "Faculty", "phd": "PhD", "shared-administrative": "Public & Administrative"}[sheet.key],
                 "zoneSpaceRecordId": zone["spaceRecordId"], "floorPlanRecordId": FLOOR_PLAN_RECORD_IDS[sheet.key], "level": "Level 2",
                 "image": f"{sheet.key}.png", "svg": svg_path.name, "pdf": f"../../../output/pdf/kaplan-{sheet.key}.pdf",
                 "revision": "draft-02", "layoutBasis": "source-relative-room-tracing", "sourceCrop": dict(zip(("x", "y", "width", "height"), CROPS[sheet.key])),
                 "coordinateWidth": sheet.width, "coordinateHeight": sheet.height,
                 "imageWidth": sheet.width * 3, "imageHeight": sheet.height * 3,
                 "geometry": [d for d in sheet.desks if d["spaceRecordId"]],
                 "referenceWorkstations": [d for d in sheet.desks if not d["spaceRecordId"]]}
        (folder / f"{sheet.key}.json").write_text(json.dumps(entry, indent=2) + "\n")
        plans.append(entry)
        if render or pdf:
            render_svg(svg_path, folder / entry["image"], sheet.width * 3, sheet.height * 3)
        if pdf:
            pdf_folder = ROOT / "output/pdf"
            pdf_folder.mkdir(parents=True, exist_ok=True)
            w, h = (792, 612) if sheet.width > sheet.height else (612, 792)
            render_svg(svg_path, pdf_folder / f"kaplan-{sheet.key}.pdf", w, h, pdf=True)
    linked = [desk["spaceRecordId"] for plan in plans for desk in plan["geometry"]]
    assert len(linked) == len(set(linked)) == 64, "Every existing workstation must appear exactly once."
    manifest = {"version": 2, "revision": "draft-02", "status": "source-layout-review-draft", "baseId": draft["baseId"],
                "sourceAnnotationSha256": draft["annotationSha256"],
                "notes": ["Each file has its own coordinate system; use only its matching geometry.",
                          "Linked geometry preserves existing Space IDs; it does not create workstations.",
                          "Reference desks are visual placeholders and must not be imported as active inventory.",
                          "Room footprints and circulation are simplified traces of the old source, not surveyed dimensions.",
                          "PhD positions are proposed. All arrangements need on-site confirmation.",
                          "No Airtable writes are performed by this generator."],
                "plans": [{k: v for k, v in p.items() if k not in ("geometry", "referenceWorkstations")} for p in plans]}
    (folder / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if pdf:
        package_bundle(folder)
    print(f"Generated {len(plans)} plans: 64 linked desks and 52 reference desks in {folder}")


def package_bundle(folder):
    """Keep the downloadable packet in sync with the individual revised files."""
    path = ROOT / "output/kaplan-zone-plans.zip"
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        for key in CROPS:
            archive.write(ROOT / f"output/pdf/kaplan-{key}.pdf", f"Print PDFs/kaplan-{key}.pdf")
            for ext, directory in [("png", "Airtable PNGs"), ("svg", "Editable SVGs")]:
                archive.write(folder / f"{key}.{ext}", f"{directory}/{key}.{ext}")
        archive.writestr("READ ME.txt", """KAPLAN LEVEL 2 - ZONE PLANS
Draft 02 / September 7, 2026

Four independent sheets: MDes, Faculty, PhD, Public & Administrative.
The revised plans retain source room footprints, circulation, stairs, furniture
context and original numbered desk positions. They are simplified tracings of
the older drawing, not surveyed dimensions or a verified current inventory.

PDF: one US Letter page per zone, with vector text and paths.
PNG: attach one image to each zone's Floor Plans record in Airtable.
SVG: editable vector artwork.

All 102 original numbered desks are retained, plus 14 proposed PhD positions.
Solid desk outlines: existing workstation record references (64).
Dashed desk outlines: source inventory still to check (52).
Pale furniture and desks in neighboring areas are orientation context only.
Neither outline indicates occupancy. Confirm the layout during the walkthrough.

Each PNG has its own coordinate system. The revision's matching JSON files are
in assets/floor-plans/zones in the repository. Use Draft 02 coordinates with
Draft 02 images; Draft 01 coordinates and whole-floor coordinates do not align.
The PDF desk labels use source numbers; JSON also keeps the zone prefixes.
The four zone plan records, PNG attachments and 64 linked seat shapes are now
saved in the pilot Airtable base. Earlier layouts are uploaded as inactive
comparison versions. No workstation inventory or person assignments were created.
Plan IDs remain in the matching JSON files; saved geometry IDs are recorded in
docs/floor-plan-pilot/airtable-map-deployment.json. Airtable holds later map edits.
""")
    with ZipFile(path) as archive:
        assert archive.testzip() is None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="Also export PNG images using librsvg/Cairo")
    parser.add_argument("--pdf", action="store_true", help="Also export individual print PDFs (includes PNGs)")
    args = parser.parse_args()
    build(render=args.render, pdf=args.pdf)

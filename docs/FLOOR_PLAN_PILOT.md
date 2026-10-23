# Kaplan Level 2 zone-plan pilot

Updated September 7, 2026. The current direction is **one independent, simplified seating plan per zone**, with a checklist in the extension to choose plans to view and print. This replaces the earlier recommendation to use only one full-floor architectural background.

The owner asked to retain all drawn workstations for now and will confirm the actual layout during the September 8 walkthrough. **Draft 02** makes the layouts less abstract: it restores connected room outlines, circulation, stairs and source furniture context. The files remain review drafts, not a verified furniture inventory.

## Zone files

Every zone has an editable SVG, an image for Airtable, a matching coordinate JSON file, and a separate US Letter PDF. PDF text and paths remain vector. The plans now use proportional views of one shared floor tracing: perimeter edges, room footprints, selected door openings, stairs, lounge/circulation paths, kitchen counters and furniture. Dimensions, structural grids, equipment specifications and other architectural annotations are omitted. Each selected zone is tinted; its adjoining spaces remain visible in subdued linework. Room labels are suppressed where a crop would cut through them.

| Zone | Position and orientation | Desk symbols | Files |
|---|---|---|---|
| MDes | Left edge, portrait | All 72 original numbered desks; 50 existing records, 22 reference desks | [PNG](../assets/floor-plans/zones/mdes.png), [SVG](../assets/floor-plans/zones/mdes.svg), [PDF](../output/pdf/kaplan-mdes.pdf), [coordinates](../assets/floor-plans/zones/mdes.json) |
| Faculty | Bottom edge, landscape, including the lower work/flex areas | 20 reference desks, F01-F20; current inventory and occupants unverified | [PNG](../assets/floor-plans/zones/faculty.png), [SVG](../assets/floor-plans/zones/faculty.svg), [PDF](../output/pdf/kaplan-faculty.pdf), [coordinates](../assets/floor-plans/zones/faculty.json) |
| PhD | Right edge, portrait, with faculty connection at bottom | 14 existing records, P07-P20, in proposed pairs | [PNG](../assets/floor-plans/zones/phd.png), [SVG](../assets/floor-plans/zones/phd.svg), [PDF](../output/pdf/kaplan-phd.pdf), [coordinates](../assets/floor-plans/zones/phd.json) |
| Public & Administrative | Shared core, landscape | All 10 numbered staff desks, S01-S10, as reference inventory | [PNG](../assets/floor-plans/zones/shared-administrative.png), [SVG](../assets/floor-plans/zones/shared-administrative.svg), [PDF](../output/pdf/kaplan-shared-administrative.pdf), [coordinates](../assets/floor-plans/zones/shared-administrative.json) |

Solid desk outlines mean an existing Airtable workstation record is referenced. Dashed outlines mean a source-plan workstation still needs inventory verification. Neither means occupied or available. Colors identify zones. The PhD arrangement is explicitly proposed even though its workstation records already exist. Faculty work/flex rooms now follow their actual source footprints and show source furniture as context; the first draft's generic A-C boxes are removed. The numbered MDes, faculty and staff desk centers are extracted from the original PDF's text positions. This is a visual reference, not a measured drawing.

There are **116 primary numbered desk symbols: 64 linked workstation proposals and 52 reference desks**. The 64 existing Space IDs each occur once in the coordinate manifests. Subdued furniture and neighboring desks can also appear as orientation context, without extra inventory or geometry records. The older plan's bottom “Faculty/PhD” desk numbers do not become new PhD assignments. The right-side proposed PhD desks replace the obsolete loose-table arrangement in that strip; their location still needs confirmation.

The [manifest](../assets/floor-plans/zones/manifest.json) lists each file, its zone link, source crop and dimensions. The two portrait PNGs are 2640 × 3420; the two landscape PNGs are 3420 × 2640. Each JSON's normalized `x`, `y`, `width` and `height` refer to the **entire matching image**, including its title and locator. **Draft 02 has new coordinates**; use its PNG and JSON together. Do not pair them with Draft 01 coordinates, a further crop, the old full-floor plan or a different zone's file. On the drawing, desk labels use the source numbers; JSON also retains zone prefixes in `label` and the printed number in `displayLabel`.

`geometry` contains only existing workstation record references. `referenceWorkstations` contains the unlinked visual desks and must not be imported as verified inventory. `floorPlanRecordId` now points to each zone's existing Airtable record, and the generator preserves these IDs. Faculty and administrative `zoneSpaceRecordId` values remain null until their broad zone records and memberships are settled. The manifest is a review aid, not a supported automatic importer.

The 64 linked seats are now saved in Airtable for review: 50 MDes and 14 proposed PhD positions. Matching mappings also exist for the first abstract zone sheets, original numbered floor plan and early zone overview. These are **256 geometry records referencing the same 64 Spaces**, not additional desks. The [deployment receipt](floor-plan-pilot/airtable-map-deployment.json) records each saved geometry ID, plan link, Space link, image checksum and coordinates. After moving a shape in the extension, Airtable holds the updated position; treat this receipt as an import checkpoint, not a live mirror.

Regenerate the SVG, PNG and PDF files together after changing the layout code:

```sh
python3 tools/render_zone_plans.py --pdf
```

The generator uses Python's standard library, Poppler's `pdftotext` and system librsvg/Cairo, performs no Airtable writes, and retains editable vector output. Room and circulation traces are maintained in `tools/kaplan_reference_layout.py`; crop transforms and desk mappings are in `tools/render_zone_plans.py`. `--pdf` also refreshes the [downloadable bundle](../output/kaplan-zone-plans.zip). The [earlier full-floor overlay](floor-plan-pilot/zone-layout-draft.png) and its [source geometry](floor-plan-pilot/zone-layout-draft.json) remain historical reference artifacts.

## How this works in Airtable

Target base: [SDS_Facilities & Access Manager](https://airtable.com/appr3HkHrFMEyePyN).

| Existing Floor Plans record | Plan File attachment |
|---|---|
| [Kaplan Level 2 - MDes](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/reczg3WErH2SXW44D) | `mdes.png` |
| [Kaplan Level 2 - Faculty](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recPQVQAJu0sV36ta) | `faculty.png` |
| [Kaplan Level 2 - PhD](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/rechmO5RMbvv8LCKr) | `phd.png` |
| [Kaplan Level 2 - Public & Administrative](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recytZCyzHuJyoY2d) | `shared-administrative.png` |

Earlier versions are attached to separate records with **Active? unchecked**:

| Comparison record | Linked seats |
|---|---|
| [MDes - Draft 01 (Abstract)](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recA56XJcvgIRzlTq) | 50 |
| [Faculty - Draft 01 (Abstract)](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recRUJ8K3DPI9bvdM) | 0; 20 reference desks |
| [PhD - Draft 01 (Abstract)](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recGw87IiAwbkGVL4) | 14 proposed positions |
| [Public & Administrative - Draft 01 (Abstract)](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recFFPN6IpsyqmoHM) | 0; 10 reference desks |
| [Original Numbered Floor Plan](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recmjz41vDiw18aoC) | 50 MDes + 14 proposed PhD positions |
| [Early Zone Overview](https://airtable.com/appr3HkHrFMEyePyN/tbleh5yFAuV2KUsbp/recvn641evvmYwhiL) | 50 MDes + 14 proposed PhD positions |

Check **Active?** on an earlier record to make it available in the extension, then select it under **Plans to view / print**. Leave both versions active to compare them, or uncheck the current version to hide it. Each version keeps its own geometry. The [Draft 01 archive](../assets/floor-plans/versions/draft-01/manifest.json) preserves the original PNG, SVG and PDF files from commit `ae3579b2ef1a2113ed28b7de9c39bc5b4eecfb80`; its JSON files now include the new plan-record IDs. Historical captions remain as originally drawn. The overview's mapped coordinates account for its header, footer and embedded plan placement.

1. In **Floor Plans**, these four records already exist, with their Draft 02 PNGs attached, `Level` set to `Level 2`, and `Active?` checked. Reuse these records for layout updates.
2. Add an optional **Zone** field linking to one record in **Spaces**. Link MDes to `MDes Student Workspace Area` (`recmBD1D59hycFitC`) and PhD to `PhD Student Workspace Area` (`reccjuSTjZ1r118rY`). Create/resolve the broad faculty and public/administrative zone records after the walkthrough, then link their plans. This field enables accurate area filtering, per-plan workstation lists and plan-based totals. The extension does not create fields or records automatically.
3. The corresponding **PNG** is already in each record's **Plan File** attachment cell. For future revisions, replace the current image on that same record and update its matching geometry. Each cell should contain one current image for that zone; the PDF may also be attached as a reference. The extension prefers the first supported image over PDFs. If retaining an older full-floor overview, keep it in a separate record with Zone blank.
4. In the updated extension, choose the floor. **Plans to view / print** lists active plans; check one, several or all. Zone sheets are selected by default when Zone links exist. With no zone sheets, the first active full-floor plan remains the default. Clearing the selection leaves no maps selected. **Workspace area** narrows the compatible plans and mapped spaces.
5. The 50 existing MDes and 14 existing PhD records already have saved clickable areas. Click a mapped desk to select its workstation and assignment details. Each plan card has **Map workstations** for adjusting that image's shapes during the layout review. **Save map edits** persists changes, and **Exit mapping** returns to the selected plans. The 52 reference desks have no inventory records or clickable seat shapes yet. Use each version's matching JSON as a source reference; do not overwrite a reviewed Airtable edit with an older checkpoint.
6. Choose **Print selected plans** to print one complete sheet per page, with current assignment highlights. Printing fits the full image and geometry independently of on-screen zoom/pan and waits for image loading. A missing or failed image stops the requested print with an explanation. **Print workspace roster** remains a separate action and uses the selected plans' spaces.

The images already contain desk labels, so **Show record labels** is off initially to avoid duplicate lettering. Turn it on for an unlabeled source image. **Highlight available workstations** limits the operational overlays and workstation list to the date range; it does not erase desk symbols embedded in the source image. Uncolored desks are not proof of availability.

Attachment URLs are read from the current record; geometry keeps stable Floor Plan and Space links. No GitHub image hosting is needed. Airtable's [attachment instructions](https://support.airtable.com/articles/9139007724-attachment-fields-in-airtable) describe the cell upload control, and [attachment URL behavior](https://support.airtable.com/articles/9671148410-airtable-attachment-url-behavior) explains why download URLs should not be copied into configuration.

## Zone overlap and identity

Each workstation keeps one Space record, its assignment history, and one primary parent in the existing hierarchy: Building → Floor → Zone → optional Room → Workstation. If a shared workstation later needs to appear on both the faculty and PhD sheets, create a geometry record on each plan pointing to **the same Space ID**. The plan selection and totals combine those identities once. Do not clone the workstation or its person assignments.

Area filtering still follows the primary Space hierarchy. A geometric overlap does not add a second primary parent. When viewing all workspace areas, explicit geometry can show a shared workstation on a neighboring plan. A specific Workspace area filter continues to narrow those records by hierarchy. Calling an area public does not change room access permissions.

## Live base checkpoint and remaining rollout

The zone records, comparison images and seat geometry were saved and read back through the connected Airtable tools on September 7 (September 8 UTC). Airtable processed all ten PNGs and generated thumbnails with the expected filenames and dimensions. The four current attachments were downloaded and verified in the earlier upload; the six comparison attachments were downloaded and verified in this mapping update. Each matches its prepared source file exactly. The development extension is served locally; production release and interaction inside Airtable remain unverified.

- Checkout target: base `appr3HkHrFMEyePyN`, extension `blkyXmfJYFXj8cJwa`.
- `Floor Plans` (`tbleh5yFAuV2KUsbp`) now has 11 records: four active Draft 02 zone plans, four inactive Draft 01 zone plans, the inactive original numbered drawing, the inactive early zone overview, and the existing inactive AutoCAD PDF reference. The original numbered record now has its PNG attachment and a clearer comparison name.
- `Floor Plan Geometry` (`tblIpc3ShEuxNJsJ3`) now has 257 rows: 256 saved seat shapes plus the pre-existing empty row, which was preserved. All new shapes have one Floor Plan link, one existing Space link, matching normalized coordinates and `Visible?` checked.
- `Spaces` had 129 records, including the 50 MDes and 14 PhD active workstations.
- **Space Assignments** (`tblKHq2ZiWkY0vZ9U`) had 65 rows using the Fall 2026 dates of August 17-December 12. These are the owner's semester assumptions. All 49 Primary Desk Holder rows had Person links; twelve Steward and four Occupant rows did not.
- People had no Email or Person ID fields. Equipment, key-copy and facilities-request detail adapters remain separate work; the current panel covers people, spaces, assignment dates/history and assignment-level access requirements.

A direct image upload using the existing local Blocks CLI credential was previously rejected by Airtable with HTTP 403, `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`. The upload was subsequently completed through the connected Airtable tools using temporary GitHub download links for the PNGs already in the private repository. Git blob hashes confirmed that those files matched the latest local images before import. Airtable now stores its own attachments; the temporary GitHub links are not retained in project configuration. Manual file upload is no longer required. The local Blocks credential itself was not changed.

For the September 8 walkthrough, check the actual MDes pod order/count, the 14 proposed PhD positions, which bottom desks/work areas are faculty, and the ten staff desk positions. Record renumbering and shared workstations against the existing IDs before turning the reference symbols into inventory.

After that review: resolve the two broad zones, correct the saved geometry as needed, reconcile the 52 reference desks with actual inventory, then test selection and printing inside Airtable before releasing the extension. A local build does not publish the extension.

## Verification

The automated checks cover hierarchy filtering, optional Zone mapping, persisted field IDs, empty/multiple plan selection, deduplication of shared desks, separate print orientations and assignment status/date filtering. Map saves are scoped to the edited plan and acknowledge saved record IDs after each batch, so another save or a retry after a later batch fails cannot duplicate already saved shapes. The complete lint/test/TypeScript/browser-build check passes. Each of the four PDFs was reopened and rendered with Poppler for visual inspection; the manifests preserve 64 distinct existing workstation IDs and exclude the 52 reference desks from linked geometry.

For this data update, all 256 imported shapes were read back and compared against their intended links and coordinates. A temporary fixture of the live records was passed through the extension's actual schema discovery and data mappers: rendering the ten plan views produced exactly 256 seat buttons, and rendering details for all 49 linked person assignments included the expected assigned person. The 35 relevant existing mapper, geometry, floor-plan, selection and UI tests also pass. These rendering checks do not establish browser interaction or Airtable iframe behavior.

Live interaction in Airtable, browser print-dialog pagination and production release still require an available browser session. The standalone PDFs are ready for the walkthrough independently of that rollout.

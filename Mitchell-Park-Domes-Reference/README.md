# Mitchell Park Domes — reference pack for a three.js build

Reference photos and drawings of the Mitchell Park Horticultural Conservatory ("The Domes"), 524 S. Layton Blvd, Milwaukee, Wisconsin. Three conoidal glass domes built 1959–1967, designed by architect Donald L. Grieb with engineer Charles Whitney.

I read "the Milwaukee dome" as this building, the only domed landmark of its kind in Milwaukee. If you meant a different building (the Milwaukee Art Museum, for example), say so and I'll re-cut the pack.

## What's inside

| Folder | Contents |
| --- | --- |
| `00-overview.jpg` | Contact sheet of every photo in the pack, with filenames, for quick browsing |
| `01-exterior/` | 14 photos: overall massing, approach views, entrance arches, buttress detail, façade panel grid, dusk and night lighting, panorama |
| `02-interior/` | 19 photos: dome interiors, the glass grid seen from inside, the apex compression ring from several angles, lobby |
| `03-floor-plans/` | Existing first-floor plan, lower-level plan, basement plan, NRHP boundary site plan, aerial context, a schematic site diagram I drew from the measurements, and the full 75-page National Register nomination |
| `04-structure-details/` | Patent section drawing of the dome's structural tiers, plus two 1960s construction photos (apex ring being lifted, hub connection) |
| `BUILD-NOTES.md` | Dimensions, the traced profile curve, how the panel tiers work, site layout, and a three.js recipe |
| `CREDITS.md` | Author and licence for every photo, and sources for the drawings |

## How to use it

Start with `BUILD-NOTES.md`. The dome is not a hemisphere and not a geodesic sphere — it is a pointed, bulbous conoid whose widest point sits about 40 % of the way up. That single difference is what makes a model read as "the Milwaukee Domes" rather than "a dome". The notes give you a normalised profile table you can drop straight into a `LatheGeometry`, the radius of each structural tier, and the footprint spacing of the three domes.

For proportions, work in feet at 1 unit = 1 ft: 140 ft diameter, 85 ft tall. The three domes are equal; only the planting inside differs.

## Accuracy and rights

The photos are reference images, not survey data. Most were shot from ground level, so expect mild perspective distortion; the profile curve in the build notes is a fit to one of them and is close, not exact.

Photographs are CC BY-SA 3.0/4.0 or public domain, mostly by DiscoA340 and Michael Barera, with two by other photographers. **Attribution is required** for the CC BY-SA images, and derivative works you publish must carry the same licence. `CREDITS.md` has the per-file list; keep it with any published build.

The floor plans come from the National Register of Historic Places nomination prepared for the City of Milwaukee in 2026, a public document. They are existing-condition drawings of the building, useful for massing and room layout, and not construction documents.

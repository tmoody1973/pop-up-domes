# Hinged paper cards: how they are built and how they fold

This document explains how hinged paper cards ("flaps") are built and animated. It is for anyone writing new card
props or a large hinged set-piece, such as a dome, that must work with the existing fold engine.

Several source comments point to `docs/ARCHITECTURE.md`, `ref/CHECKLIST.md` and `tools/blender/*.py`. None of these
exist in this fork or in upstream `xikhar/papertrails` (checked with `gh api`, 2026-11-17). This file replaces the
missing architecture doc. It was reverse-engineered from the code and from `public/models/tiles.glb`. Statements
marked **(inferred)** come from reasoning, not from a line of code or a measured value.

Citations use `path:line`, relative to `app/`. three.js is 0.187.0 (`node_modules/three/package.json`).

Evidence scripts live in the session scratchpad. They are not part of the app:
`dump_glb.js` (node tree, transforms and extras), `dump_mesh.js` (per-face attributes), `prove_wobble.mjs` (end-to-end
proof), `flat_check.mjs` (checks the conventions on all 510 top-level flaps) and `bl_card.py` (Blender 5.2 round trip).
Their results are quoted below.

---

## 0. The pipeline in one picture

```
tiles.glb (one top-level node per model id)
  └─ loader.js adopt(): strip "<model>__" name prefix, normalise hinge userData, swap in ONE shared paper material
       └─ prototype Group per model id               (getTilePrototype(id), shared, never added to the scene)
            ├─ world.js createRecord(): clone(true) -> createFoldInstance(clone) -> one BatchedMesh instance per mesh
            │    streaming: spawn -> pending -> rise() setTarget(1) -> ... -> setTarget(0) -> settled flat -> pool
            └─ book.js bake(): clone -> createFoldInstance -> snap(0) -> top-down orthographic render = flat print on the page
```

* The per-tile Object3D tree exists only so fold.js can do its maths. It is **never added to the scene**. Every mesh
  is drawn as an instance in one `THREE.BatchedMesh` per material, and world matrices are copied across while the
  tile moves (`src/world/world.js:3-7`, `:827-838`).
* Tile `base` meshes are not drawn. The book page shows a baked print of each model instead (`src/world/world.js:6-7`,
  `:40-44`, `:97-100`; `CONFIG.world.renderBases: false`, `src/core/config/world.js:77`).

---

## 1. Flap anatomy

### 1.1 Node naming and hierarchy (glb)

Measured with `dump_glb.js` on `grove`, `house`, `bridge` and `desert_dunes`:

```
grove                         extras {"model":"grove"}                 <- top-level node, name == MODELS id
├─ grove__base                (mesh, y≈0, spans [-1,1]² = one 2x2 tile) <- required, never a hinge
├─ grove__tree_a              extras {hinge, foldAngle: 1.60539, delay: 1, layer: 2}
│   ├─ grove__tree_a_xb       extras {hinge, foldAngle: 1.5708, delay: 1, layer: 2}   <- crossed half-plane (nested)
│   └─ grove__tree_a_xf       extras {hinge, foldAngle: 1.5708, delay: 1, layer: 2}
├─ grove__bench               extras {hinge, foldAngle: -1.56893, delay: 0.125, layer: 5}
└─ ...
house__house_front            (layer 8)                <- nesting goes 4 levels deep in the house
├─ house__house_roof_f        foldAngle 0.61186, T=[0,0.42,0]  (hinged on the top edge of the front wall)
│   ├─ house__house_chim      foldAngle 2.52973
│   │   ├─ house__house_chim_lid, house__house_chim_x
│   └─ house__house_roof_b    foldAngle -1.22373
├─ house__house_wall_l        foldAngle  1.5708   (hinged on the front wall's vertical edge, like a door)
└─ house__house_wall_r        foldAngle -1.5708
```

* **Top-level node** = the model id exactly. The loader finds tiles by `scene.children` name and only for ids listed
  in `MODELS` (`src/assets/loader.js:325-329`, `src/core/models.js:41-98`). The node is re-zeroed, so its transform
  is ignored (`src/assets/loader.js:332`).
* **Names inside a model** are `<model>__<piece>`. Blender object names are global, so the prefix keeps them unique.
  The loader strips it (`src/assets/loader.js:188-193`, `:213`). From here on, names mean the stripped form.
* **A prototype is rejected** (and the placeholder used instead) unless it has a node named `base` **and** at least one
  hinge (`src/assets/loader.js:334-335`).
* **Single- vs multi-primitive meshes.** A one-material node loads as a `THREE.Mesh` that carries the hinge userData
  itself (`prove_wobble.mjs`: `isMesh(ramp) = true`). A node with two materials, such as paper and window glow on
  `house_front`, loads as a Group with child meshes. The hinge stays on the Group (GLTFLoader behaviour, inferred from
  the two primitives in the dump).
* **Piece names are not just labels.** world.js, fold.js and cards.js match names with regular expressions, and a match
  changes behaviour (see 1.5). Choose names deliberately.

### 1.2 Hinge pivot convention

The motion of every flap comes from one formula (`src/world/fold.js:3-4`, implemented in `pose()` at `:244-267`):

```
node.quaternion = restQuaternion * RotX(foldAngle * (1 - p)) [* RotY(flutter twist)]
p = 1 -> rest pose (as authored)        p = 0 -> folded        p > 1 -> overshoot past rest
```

| Convention | Value | Evidence |
|---|---|---|
| Hinge axis | the node's **local X axis**, through the node origin | `RotX` in `pose()`, `src/world/fold.js:246-252` |
| Origin | on the card's **bottom (hinge) edge**, at mid-width | Meshes span `x ∈ [-w/2, w/2]` and `y` from `-hingeY` to the card height, for example bench `min=[-0.2165,-0.024,-0.008] max=[0.2165,0.2545,0.008]` with `T.y=0.024` |
| Card plane | local **XY**, card **+Y = up** along the card, **+Z = printed front** | per-face dump: art UVs on the ±Z faces, edge faces have in-plane normals |
| Hinge height | `y = FLAP_LAYER_GAP * (layer + 1)`, with `FLAP_LAYER_GAP = 0.004` | `src/core/config/shared.js:17-18`; `flat_check.mjs`: **510 of 510** top-level flaps match exactly |
| Card skirt | the mesh reaches **down to the page**, `min.y = -hingeY` | every dumped flap |
| Rest pose | **upright**: node yaw plus a slight hand-made lean | `flat_check.mjs`: lean from vertical median **1.13°**, p95 **2.74°** |
| Folded pose | **exactly flat**. The rest lean is built into foldAngle so that `lean + foldAngle = ±90°` (bush_g10: lean -2.7°, foldAngle -87.3°) | `flat_check.mjs`: min \|normal.y\| over 510 folded flaps = **1.00000** |
| Fold direction | `foldAngle < 0`: the top swings to local **-Z** and the **+Z (printed) face ends face-up** on the page. `foldAngle > 0`: the top swings to +Z and the +Z face ends face-down | `prove_wobble.mjs`: bench (−) normal `(0,1,0)`, tree_a (+) normal `(0,−1,0)`. Glb: 349 negative, 161 positive |
| Non-quarter folds | props that rest tilted fold through less than 90°, for example bridge ramps −26°, bridge sides 70°, logs −56°, jetties −6° | `flat_check.mjs` (11 top-level flaps) |
| Rest cache | the authored rest quaternion is cached in `userData.restQuaternion` when the instance is created; a clone may have turned it into an array or plain object | `src/world/fold.js:72-84` |

**Nested flaps** are expressed in their parent's frame. Their own local X is their hinge axis. Crossed tree planes
(`*_xb` / `*_xf`) have the rest rotation `(±0.5, ±0.5, 0.5, 0.5)`, sit `±0.0092` off the parent's faces (just outside
the `±0.008` card) and fold ±90° flat against the parent (glb dump). House walls are hinged on the front wall's
vertical edges, and roofs on its top edge.

Because `foldAngle < 0` puts the printed +Z face up, a single-printed card must fold negative to show its print on
the page. Positive folds suit double-printed cards such as trees (both faces carry art, see 2.2). **(inferred)**

### 1.3 userData keys

glb `extras` become three `userData` through `Object.assign(object.userData, extras)`
(`node_modules/three/examples/jsm/loaders/GLTFLoader.js:2413-2419`, called for nodes at `:4514`). A census over all
nodes in `tiles.glb`: `hinge` 760, `foldAngle` 760, `delay` 760, `layer` 760, `model` 48 (the top-level nodes),
`wobble` 5. Nothing else is authored. In particular, `size`, `stiffness` and `sway` are unused in the shipped assets.

| Key | Type | Range / default | Read at | Effect |
|---|---|---|---|---|
| `hinge` | bool | must be truthy | `fold.js:100`; normalised at `loader.js:215-216` | Makes the node a flap. Any node in the hierarchy can be one. |
| `foldAngle` | number (rad) | default `π/2` (`fold.js:131`). A non-finite value is replaced by `π/2` and counted as bad (`loader.js:217`, `:220`) | `fold.js:131`, used in `pose()` `:246` | Rotation about local X from rest (p=1) to folded (p=0). The sign picks the side (see 1.2). |
| `delay` | number | clamped to `0..1` (`loader.js:218`, `fold.js:127`). Default 0 | `fold.js:127`, `:184` | Stagger slot within the instance: rise start `tUp = delay * staggerSpan` (0.34 s), fold-down start `tDown = span - tUp` (exact reverse) (`fold.js:182-188`). The glb spaces delays evenly as `i/(n-1)`; nested children copy their parent's value. |
| `layer` | int ≥ 0 | rounded and clamped (`loader.js:219`). Default 0 | `fold.js:133` | Not used by the dynamics. It goes into the `'fold'` event (`fold.js:299`), where `src/audio/paper.js:439` uses it to seed the sound. The layer→hinge-height rule (1.2) is a **geometric authoring rule**: it stops flat cards from z-fighting. Shadow bias is tuned so that flat layers cast no shadow (`src/core/config/render.js:53`). |
| `wobble` | number | default 1. Effective value `wob = clamp(wobble * (spring.wobble/0.06) * (1 + (wobbleLarge-1)*sizeT), 0.2, 2.5)` | `fold.js:124`, `:135`, `:146-147` | Flutter after the latch. Lower wobble raises the damping (`cL = 2*flutterDamping/√wob * ω`) and the drag, so the card is stiffer. Glb uses 0.6 for ramps and jetties, 1.6 for the oasis ripple. Proved end to end in section 7. |
| `stiffness` | number | `max(0.25, stiffness ?? 1)` | `fold.js:120-121` | Frequency scale `fs ∝ √stiffness`. Multiplies the rise/fall spring constants (`k ∝ fs²`, `fold.js:140-144`). **This is the knob for slowing very large flaps**, because `size` saturates (below). |
| `size` | number | default: rest-pose bbox height / `TILE_SIZE`, clamped to `0.05..1` (`fold.js:102-111`), then cached in userData | `fold.js:102`, `:119` | `sizeT = (size - 0.12)/(0.7 - 0.12)` clamped `0..1`. It lerps frequency (`freqSmall 1.14` → `freqLarge 0.88`), rise damping (`dampingLarge`), wobble (`wobbleLarge`), friction and twist. Anything taller than 1.4 units counts as "largest". Also sent in the `'fold'` event. |
| `sway` | number | default 1 | `fold.js:209` (top-level flaps only, `:196`) | Multiplies the idle wind sway. `0` takes the flap out of the wind entirely (the amplitude falls below the cutoff at `:210`). |
| `spin` | bool | set at **runtime** by world.js on a split-off windmill sail mesh (`world.js:600-605`) | `fold.js:198` | That child spins about its local Z (`fold.js:387-391`). |
| `restQuaternion` | Quaternion / array / object | written by fold.js | `fold.js:73-84` | Cache of the authored rest pose. Do not author it. |
| `model` (top node) | string | set by the loader (`loader.js:337`) | world.js, book.js | The model id. |
| `tileId` (tile group) | string | set at spawn (`world.js:909`) | `fold.js:94`, `:296` | Seeds the jitter hash and labels the `'fold'` event. |
| `glow` (mesh) | bool | set by the loader on meshes whose material name matches `/glow/i` (`loader.js:224-230`) | lanterns / world | Emissive pane. Gets the shared glow material. |
| `name` | string | added by GLTFLoader (the original node name) | – | Not used by the engine. |

**The nested parent is not a userData key.** fold.js walks up to the nearest ancestor that is itself a flap
(`fold.js:112-117`). A child flap therefore:

* starts its rise at least `nestedLag = 0.02 s` after its parent (`fold.js:185`; proved: crown `tUp 0.2053` = ramp
  `0.1853` + 0.02);
* during the parent's motion, does not use its own spring. It follows the parent's progress through a stiff linkage
  (`k_n = 1500`, damping 0.8, acceleration capped at 125/s², `fold.js:316-320`, `config/fold.js:31-34`). Siblings
  therefore open together and never scissor;
* latches and quivers on its own once upright (`fold.js:308-311`), and folds down **before** its parent
  (`tDown = span - tUp`, `fold.js:188`);
* gets no wind sway of its own; it rides along with its top-level ancestor (`fold.js:196`).

### 1.4 Dynamics regimes (for reference)

All regimes are integrated with a fixed `1/240 s` step through an accumulator plus interpolation. The result is the
same at any frame rate (`fold.js:22-24`, `:404-457`, `config/fold.js:26`).

* **RISE** `p'' = k(1-p) - c p'` (`fold.js:318`)
* **LOCKED** (latched when it first reaches p ≥ 1, `:308`): flutter about upright with linear damping, `|v|v` air
  drag and dry crease friction (`:311`). Twist about the card's own axis follows the flutter (`:150`, `:253`).
* **NESTED** linkage (`:316-317`, `:319-320`)
* **FALL** `p'' = -k_d p - c_d p' - G`, braked while still travelling up (`:322-325`). At the page (p = 0) one small
  slap-bounce with restitution 0.25, then it sticks (`:330-334`). A flap that was resting upright first flicks
  slightly further (`downAnticipation`, `:432`).
* Settled when `|p - target| < 0.002` and `|v| < 0.024` for every flap (`:335`, `:440-456`).

### 1.5 Names that trigger behaviour (choose names on purpose)

| Matcher | Where | What happens to a matching top-level flap |
|---|---|---|
| `CARD_RX` (`bush\|flowers\|tuft\|rock\|…\|well\|fence…`) | `world.js:731`, used in `cardSpecs` `:705` | **Turns to face the camera** (yaw about the hinge) and is scaled by `cards.*` once upright (`world.js:784-799`) |
| `CROSS_RX` (`tree\|birch\|pear\|pine\|cactus\|palm\|dead_tree\|shroom\|column`) with `_xb`/`_xf` children | `world.js:735`, `:704` | Crossed planes swing to stand on the view diagonals |
| `TREE_RX` | `world.js:732` | Scaled by `cards.tree = 0.86` |
| `HOUSE_RX` (`house\|cottage\|cabin\|manor` + `_front/_back/_roof_*/_wall_*/_chim*`) | `world.js:733`, `:707-719` | The whole box grows ×1.3 about the midpoint of front and back |
| `THIN_RX` | `src/world/cards.js:8`, `:17-24` | May never stand (thinning; currently off: `cards.thin: 0`, `config/world.js:17`) |
| wind `loose / rigid / stiff` | `config/fold.js:79-84`, `fold.js:207-208` | Idle sway ×1.3 / ×0.04 / ×0.35 |
| `spinMatch '(^\|__)mill$'` | `config/fold.js:101`, `world.js:148-175` | Triangles at local `z ≥ 0.012` are split off and spin |
| `PIECE_CLASS`, `LOW_RX`, `SOFT_RX` | `world.js:308-310`, walk field `:417-445` | Decide whether a piece blocks the traveller |
| biome cull classes (`tree/flowers/haystack/…`, `fence`, `bush/tuft`) | `world.js:308`, `:869-898`; book `DRY_RX`/`FENCE_RX` `book.js:292-296` | Hidden in desert or snow on generic tiles |

A dome slice called `rib_03` matches none of these and gets default behaviour. One called `column_*` or `rock_*` would
be turned toward the camera. **(inferred from the regexes)**

---

## 2. How a flap's art is applied

### 2.1 One material for all cardstock

* All cardstock uses **one** shared `MeshLambertMaterial` from `materials.paper({ color: '#ffffff', side: DoubleSide })`.
  The loader swaps it onto every mesh. The only exception is meshes whose glTF material name matches `/glow/i`, which
  get the single emissive "glow" material (`src/assets/loader.js:7-8`, `:305-308`, `:224-226`). The material
  authored in Blender is discarded; **only its name matters**.
* Colour comes from **vertex colours (`COLOR_0`)**, always multiplied in. A mesh without a colour attribute renders
  white (`src/render/materials.js:12`, `:257-259`, `:588`).
* The material is double-sided, and `shadowSide = DoubleSide` (`materials.js:722-724`).
* Fibre, tooth, translucency, PCSS shadows and tone variation are added in the shader. Fibre is mapped in **object
  space**, so it sticks to a moving flap, and it needs no UVs (`materials.js:3-11`, `:274-280`, `:527-538`).
  `TEXCOORD_0` is exported but nothing in the card shader uses it **(inferred: there are no `vUv` reads in the paper
  hooks)**.

### 2.2 The art atlas (the "print" on each card)

* The texture is `public/textures/art/atlas.webp` (4096², manifest key `art`, type `art-atlas`, `flipY: false`). Sprite
  rects and outlines are in `public/textures/art/atlas.json`: 183 sprites, for example
  `trees_a_4.rect = [2692,438,240,272]` (`x, y, w, h` in pixels, y measured top-down). The loader forces `flipY=false`
  and clamp wrapping (`loader.js:283-284`), and `materials.setTextures` binds it (`materials.js:744-757`, called from
  `main.js:46`).
* **UV channel:** glTF `TEXCOORD_1` → three attribute `uv1` (`GLTFLoader.js:2335`). It is sampled through
  `vPaperArtUv = uv1` (`materials.js:244-249`, `:286`).
* **Gate:** a face shows art only where `uv1.x > 0`. Faces without art carry `uv1 = (-1,-1)`. A geometry with no `uv1`
  reads (0,0), and world.js fills a missing `uv1` with -1 when it builds the batch geometry
  (`materials.js:244-246`, `:492`, `:495`; `world.js:64`).
* **Compositing:** `albedo = mix(vertexColour, vertexColour * art.rgb, coverage)`. Art faces are authored **white
  vertex colour × baked contact AO**, so the print shows unchanged but keeps the AO (`materials.js:489-492`, `:523`).
  Dump: tree art faces have colour luminance 0.787–1.0.
* **Die-cut:** on art faces, pixels with alpha below `uPaperArt.w = 0.4` are discarded, anti-aliased by alpha-to-
  coverage. This produces the holes in fences, the bridge arch and the sails (`materials.js:493-502`, uniforms
  `:27-31`).
* **Cut-edge rim:** a pale cream band of even screen width follows every alpha cut (`materials.js:503-525`,
  `uPaperRim*` `:40-43`).
* UV values are measured from the glb. tree_a front and back faces: `uv1 u 0.6577–0.7153, v 0.1074–0.1733`, which is
  `px x 2694–2930, y 440–710`, i.e. inside `trees_a_4` with y top-down. house_front: only the +Z face has art
  (`houses_5`), and the back face is plain grey vertex colour (luminance 0.46–0.61). Dunes and ramps have **no art**:
  they are flat colour bands from vertex colours.
* **Outline orientation:** atlas `outline` points are normalised to the rect with **y up from the sprite's bottom**
  **(inferred: `trees_a_0` has its narrow trunk span `x 0.40–0.61` at `y = 0`)**. `aspect = w/h` (233/273 = 0.8535).
* The depth/shadow pass probably does not apply the alpha discard **(inferred: no custom depth material in
  world.js)**. Cut the card **geometry** to the sprite outline, as the shipped cards are (144 verts for a tree card),
  so shadows match the silhouette.

### 2.3 Card thickness and the edge strip

* Cards are **solid slabs 0.016 thick**, centred on z = 0 (`±0.008`). `CONFIG.assets.cardThickness = 0.016`
  (`src/core/config/assets.js:16`; `assets_meta.json "cardThickness": 0.016, "layerGap": 0.004`).
* Each slab has a +Z face, a -Z face, and **edge faces** whose normals lie in the card plane (dump: tree_a 36 + 36 +
  72 verts). Glued-on decoration layers stand 0.004 proud (dunes have z = ±0.012, house wall_l is 0..0.016).
* **The cut edge is coloured by vertex colour, not by a texture.** `paper()` documents `edge = true (ignored: cut edges
  come from vertex colours)` (`materials.js:703-704`). Dump: house edge faces have luminance 0.79–0.90 (cream), dune
  edges 0.77–0.90, tree edges about 0.12 (dark).
* `public/textures/paper/edge_strip.png` (manifest `edgeStrip`) is used **only by the book block** (stacked page edges,
  `src/world/book.js:353-358`), not by cards. The manifest's `printAtlas` (`paper/print_atlas.png`) is loaded by the
  generic manifest loop (`loader.js:274-287`) but **nothing in `src/` references it** (grep: no hits for `printAtlas`
  outside the manifest). The live "print" on cards is the `art` atlas above.
* Windows and lantern glass are separate primitives with a `glow` material, sitting 0.001 proud of the face (house
  front glow at z = 0.009).

### 2.4 Double-sided cards

* Every card is a closed slab rendered with a DoubleSide material, so both faces always draw.
* A face is **printed** only if it has art `uv1`. Trees and bushes carry art on **both** faces (same UV rect on +Z
  and -Z). House fronts carry it on +Z only. Either face can therefore be the one that lies on the page.
* The gold-pass camera-facing turn picks "the nearest of the two" faces (`world.js:761`, comment: "both faces are
  printed"). So any card matched by `CARD_RX` must be printed on both sides, or its blank back will show.

---

## 3. Lifecycle: from cell to fold instance and back

| Step | Code | Notes |
|---|---|---|
| WFC assigns a cell `{model, rot, biome, tileId}` | `world.js:569-576` | `rot` → `group.rotation.y = -rot·π/2` (`models.js:111-113`) |
| Book inks the print ahead of the rise | `world.js:1059`, `book.js` | The page already shows the flat twin |
| **spawn**: pop a pooled record for the model, or `createRecord(model)` | `world.js:900-939` (`:906`) | Positions the group at `cx*2, 0, cz*2` with Y rotation; biome tint; cull; **`fold.snap(0)`** (`:932`); `shown=false` |
| `createRecord`: `getTilePrototype(model).clone(true)` → windmill sail split → `createFoldInstance(g, info)` → one BatchedMesh instance per renderable mesh, hidden | `world.js:589-680` (`:590`, `:631`, `:634`), `addInstance` `:282-300` | Each `rec` owns one fold instance for the **whole tile** |
| **pending**: inside the reveal ring and not too far behind the heading. The ripple timer is `dT * rippleDelay (0.055 s/tile) ± jitter` | `world.js:1062-1078` | Reveal: `dF < RV` from a point `forwardBias = 1.35` tiles ahead, or `dT < REVEAL_RADIUS * 1.07` from the traveller (`:1057`, `:1062`, `:1091`). `REVEAL_RADIUS = 3` tiles (`shared.js:7`) |
| **rise**: once on the page, inked and the timer has run out (max 6 per frame; held while the traveller stands on a flat tile) → `setShown(true)`, **`fold.setTarget(1, 0)`** | `world.js:1094-1104`, `rise()` `:957-963` (`:961`) | Also re-rise if the tile is still shown with target 0: `:1071` |
| Each frame while moving: `fold.update(dt)` → `writeMatrices` (copies node world matrices into the batch, plus the card fix) → `book.setTwin(progress)` cross-fades the flat print | `world.js:1123-1128`, `:827-838` | Idle and settled upright: `applyWind` + `writeSway` (`:1129-1133`) |
| **fold-back**: off the page, or behind the heading by `foldBehind = 2.6` rows, or beyond `FOLD_BACK_RADIUS = 4.25` (+ hysteresis), and at least `minFlipInterval = 2 s` since the last flip → **`fold.setTarget(0, delay)`**. Behind-rows stagger by sideways distance | `world.js:1107-1121` (`:1120`) | `shared.js:9`, `config/world.js:57-67` |
| Settled flat → `setShown(false)` (instances hidden, book hold released, twin = 1) | `world.js:1134`, `:840-848` | |
| **despawn → pool**: shown false and not pending → push to `pool[model]`. Teleport: `dT > DESPAWN_RADIUS(6) + 4` forces `snap(0)` | `world.js:1136-1137`, `:941-955` | Pooled records keep their fold instance and their batch instances. Reuse = re-position + `snap(0)` |

Facts about `setTarget` (`fold.js:345-359`):
* It acts on the **whole instance**: one target for every flap of the tile. Per-flap timing comes only from `delay`
  (within `staggerSpan = 0.34 s`) and from nesting.
* The optional `delay` argument postpones the **entire** instance (`extraDelay`, `:350`, `:418`).
* It is a no-op if the target is unchanged. A flap that never left for the old target just stays (`:355`).
* `snap(p)` places every flap instantly with zero velocity (`:269-287`). A new instance starts at `snap(0)` (`:288`).

---

## 4. Recipe: adding a new card prop

### 4.0 Checklist (applies to both routes)

1. A card is a slab 0.016 thick in local XY. +Z is the printed front, the origin is at mid-width on the bottom edge,
   +Y points up the card, and the skirt reaches down to the page (`min.y = -hingeY`).
2. Hinge node at `y = 0.004 * (layer + 1)`. Pick a `layer` no flap overlapping it in plan view already uses.
3. Rest pose upright (a ±1–3° lean reads as hand-made). Set `foldAngle = sign * 90° - lean`, so that p = 0 is exactly
   flat. Use a **negative** sign for single-printed cards, so the print lands face-up.
4. `delay ∈ [0, 1]`. Nested pieces are parented under the flap they hang from, copy its `delay` and `layer`, and fold
   flat against it.
5. Art faces: `uv1` inside the atlas sprite rect (v top-down), vertex colour white × AO. Faces without art:
   `uv1 = (-1,-1)`, vertex colour = paper colour. Edge faces: cream (about 0.9) or a darker tone.
6. Cut the geometry to the sprite outline (shadows). Print both faces if the name matches `CARD_RX` / `CROSS_RX`.
7. Name it with section 1.5 in mind. Set `sway: 0` for anything that must not rock.
8. The footprint must fit in the tile (`[-1, 1]²` local) when standing **and** when folded flat. The book bake camera
   only sees one tile (`book.js:384`), and the walk field samples only the tile (`world.js:30-31`).

### 4.A Blender 5.2 → glTF

Blender is at `/Applications/Blender.app/Contents/MacOS/Blender` (not on PATH). A round trip was verified with
`bl_card.py` (Blender 5.2.2) and dumped with `dump_glb.js`.

Axis mapping (verified): the exporter converts Z-up to Y-up, so **Blender (x, y, z) → glTF (x, z, -y)**. In Blender
the card therefore lies in the **XZ plane**, the hinge is Blender **X**, the card rises along Blender **+Z**, and the
printed face faces **Blender −Y** (the Front view looks at it). Example: Blender location `(0.3, -0.1, 0.012)`, yaw 30°
about Z → glTF `T=[0.3, 0.012, 0.1]`, `R=RotY(30°)`.

1. Make an Empty named `<model>` with custom property `model = "<model>"`. The model id must exist in
   `src/core/models.js`, or the loader ignores the node.
2. Child mesh `<model>__base` (a 2×2 plane at z = 0, the printed ground). It is required.
3. For each card, a mesh object `<model>__<piece>` parented to the Empty (or to its parent flap):
   * Geometry in local XZ, bottom edge on local X, origin at mid-width on the bottom edge. Cut it to the sprite
     outline, then Solidify 0.016 with offset 0, and apply.
   * Location `(x, -z_tile, 0.004*(layer+1))` in Blender terms, rotation = yaw about Blender Z plus a small lean.
   * Custom properties (Object > Custom Properties): `hinge` = True, `foldAngle` (radians, float), `delay` (float),
     `layer` (int), and optionally `wobble`, `stiffness`, `sway`. They round-trip unchanged
     (`extras={"hinge":true,"foldAngle":-1.5707963267948966,"delay":0.5,"layer":2,"wobble":0.8,"stiffness":0.5}`).
   * UV maps: first `UVMap` (→ TEXCOORD_0), second `Art` (→ TEXCOORD_1). For art faces set
     `u = (rectX + xn*rectW)/4096` and `v_blender = 1 - (rectY + (1-yn)*rectH)/4096`. **The exporter flips v**
     (verified: the test card landed inside `trees_a_4`). Set non-art faces to `(-1, -1)`.
   * Colour attribute `Col` (white × AO on art faces, paper colour elsewhere).
   * Material: any material named `paper`, or a name containing `glow` for emissive panes. The loader replaces it.
4. Export (Blender 5.2 option names verified with `bpy.ops.export_scene.gltf.get_rna_type()`):
   ```python
   bpy.ops.export_scene.gltf(filepath=".../tiles.glb", export_format='GLB',
       export_extras=True,            # default False: without it no hinge data reaches three
       export_yup=True, export_texcoords=True, export_normals=True,
       export_vertex_color='ACTIVE',  # default 'MATERIAL' would drop COLOR_0 for an unlit material
       export_all_vertex_colors=False,# the test export also wrote COLOR_1; batches pick up every attribute (world.js:234-243)
       export_materials='EXPORT', use_selection=False)
   ```
5. The shipped `tiles.glb` holds **all** 48 models in one file. Regenerating it requires the original builders
   (`tools/blender/*.py`, missing), or appending new top-level nodes to the existing file (load it in Blender, add,
   re-export) **(inferred)**.
6. Register the model in `MODELS` (`src/core/models.js:41`) with sockets, tags and biomes, and give it a WFC weight in
   `src/core/config/wfc.js` (`weights`). **Watch the solver cap:** `wfc.js:49` throws above 96 options, and 95 are in
   use (`models.js:64`). An all-grass model costs 1 option (`src/world/tiles.js:11-24`, `:54-70`). One more model
   fits; a second needs the domain bitmask widened.
7. Book atlas: one bake layer per model, capped at 120 models (`book.js:286`, `:366`), at 512² on "high". This is
   automatic.

### 4.B Code-built `THREE.Group`

The procedural placeholder tiles are the in-repo template (`src/assets/loader.js:108-142`): a `Group` per flap at
`(x, FLAP_LAYER_GAP*(i+1), z)` with `userData = { hinge, foldAngle, delay, layer, size }`, and a mesh child built
from a `ShapeGeometry` in local XY. To get a real card (thickness, art, edge colour):

```js
import * as THREE from 'three';
import { FLAP_LAYER_GAP, CONFIG } from '../core/config.js';

/** One hinged, art-printed, 0.016-thick card. sprite = atlas.json sprites[key]; atlasSize = atlas.json size. */
export function makeCard({ name, sprite, atlasSize = [4096, 4096], height, x, z, yaw = 0, layer = 0, delay = 0,
                           foldSign = -1, lean = 0, material, wobble, stiffness, sway }) {
  const W = height * sprite.aspect; const H = height; const T = CONFIG.assets.cardThickness;
  const shape = new THREE.Shape(sprite.outline.map(([u, v]) => new THREE.Vector2((u - 0.5) * W, v * H)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -T / 2);                         // slab centred on z = 0
  const pos = geo.getAttribute('position'); const nrm = geo.getAttribute('normal');
  const uv1 = new Float32Array(pos.count * 2); const col = new Float32Array(pos.count * 3);
  const [rx, ry, rw, rh] = sprite.rect; const [AW, AH] = atlasSize;
  for (let i = 0; i < pos.count; i++) {
    const cap = Math.abs(nrm.getZ(i)) > 0.9;           // front/back face vs cut edge
    const xn = pos.getX(i) / W + 0.5; const yn = pos.getY(i) / H;
    uv1[i * 2] = cap ? (rx + xn * rw) / AW : -1;        // -1 = "no art" (materials.js:492)
    uv1[i * 2 + 1] = cap ? (ry + (1 - yn) * rh) / AH : -1; // atlas v is top-down (flipY false)
    const c = cap ? 1 : 0.9;                            // white art face, cream cut edge (edge colour = vertex colour)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = c;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, material);           // pass assets.materials.paper so it joins the existing batch
  mesh.name = name + '_mesh'; mesh.castShadow = true; mesh.receiveShadow = true;
  const flap = new THREE.Group();
  flap.name = name;
  flap.position.set(x, FLAP_LAYER_GAP * (layer + 1), z);
  flap.rotation.set(lean, yaw, 0, 'YXZ');              // yaw, then a small lean about the hinge
  flap.userData = { hinge: true, foldAngle: foldSign * Math.PI / 2 - lean, delay, layer,
                    ...(wobble !== undefined && { wobble }), ...(stiffness !== undefined && { stiffness }),
                    ...(sway !== undefined && { sway }) };
  flap.add(mesh);
  return flap;
}
```

Notes and limits:
* **Where to attach it (inferred).** The cleanest hook point is `src/main.js` between `loadAssets` / `setTextures`
  (`:45-46`) and `createWorld` (`:49`): `assets.getTilePrototype('<model>').add(makeCard({...}))`. world.js pre-scans
  the prototypes for batch capacity at creation (`world.js:177-195`), and book.js clones them when it bakes the
  first frame (`book.js:421`, `:735`). Both happen after this point. `getTilePrototype` warns "do NOT mutate"
  (`loader.js:380`), and that applies once the world exists.
* Pass `assets.materials.paper`. A different material uuid gets its own BatchedMesh and draw call
  (`world.js:282-285`).
* Keep the attribute set to `position, normal, uv, uv1, color`. Unknown attributes are dropped with a warning
  (`world.js:286-289`). A missing `color` becomes white and a missing `uv1` becomes -1 (`world.js:61-64`).
* The ExtrudeGeometry normal test is a simple heuristic. With `bevelEnabled: false` the caps are exactly ±Z
  **(inferred)**.
* The `(lean, yaw)` Euler order 'YXZ' means yaw first, then lean about the hinge, so `foldAngle = ±90° - lean` folds
  flat. Check it with a `flat_check.mjs`-style test (folded \|normal.y\| = 1).

---

## 5. Large multi-cell set-pieces (a 140 ft dome built from tiered nested flaps)

### 5.1 Scale

The traveller is 0.6 units tall (`shared.js:21`) and a tile is 2×2 (`shared.js:4`). If the traveller is about 6 ft,
1 unit ≈ 10 ft, so the dome (140 ft across, 85 ft tall, `../Mitchell-Park-Domes-Reference/BUILD-NOTES.md:7`) is about
**14 units across (7 tiles) and 8.5 units tall**. BUILD-NOTES says "use 1 unit = 1 ft", which would make it 70 tiles
across. **This must be decided before anything is built** (open question 1). The rest of this section assumes the
traveller-relative scale.

### 5.2 What fold.js already supports

fold.js is hierarchy-generic. It does not know about tiles beyond the jitter hash and the event payload.
* **Any nesting depth.** The house goes 4 levels deep. A chain of ring tiers (base gore → tier 2 → … → cap) is a nested
  chain. Each tier starts ≥ 0.02 s after its parent, follows it through the linkage, latches on its own, and folds down
  first (`fold.js:112-117`, `:182-188`, `:304-326`).
* **Any `foldAngle`.** Tiers can rest at any angle to their parent (the house roof rests at 35°). Accordion tiers that
  fold back onto each other keep the **flat footprint small**: about one tier height instead of the whole 8.5-unit
  gore laid flat **(inferred design advice)**.
* **Any flap count.** The cost is O(flaps) per 1/240 s step, with no allocation. Several hundred flaps is fine
  **(inferred)**.
* **Feel scaling:** `userData.stiffness` (down to 0.25, i.e. half the frequency) and `wobble` per flap. `size` is
  clamped to 1 (`fold.js:108`), so an 8-unit gore otherwise behaves like a 1.4-unit tree, too snappy for its size.
* **No wind for the structure:** `userData.sway = 0` (`fold.js:209-210`). Tall flaps would otherwise get the largest
  sway, up to 2.5° (`config/fold.js:67`), which is 0.4 units at the top of an 8.5-unit gore.

### 5.3 What breaks today

| Problem | Why | Where |
|---|---|---|
| One fold instance = one tile | `createRecord` makes one instance per cell clone. A dome split into per-cell models rises tile by tile, each on its own ripple timer (`dT * 0.055 s`), and partly folds back as the traveller moves. Halves of the dome would stand at different times | `world.js:631`, `:1075-1076`, `:1112-1120` |
| Reveal radius is per tile | `REVEAL_RADIUS = 3` tiles from a point 1.35 ahead (plus ×1.07 near the traveller). A 7-tile dome is about as wide as the reveal disc, so its far side is always outside the ring and stays flat | `shared.js:7`, `world.js:1057`, `:1091` |
| Fold-back / pooling per tile | Cells behind the heading (`foldBehind 2.6` rows) or past 4.25 tiles fold and get pooled independently. The dome would close behind the traveller while he is still inside it | `world.js:1111-1121`, `:1136-1137` |
| `setTarget` covers the whole instance; stagger fixed at 0.34 s | If the dome **is** one instance, every tier and gore rises within 0.34 s (plus nesting lag). No slow ring-by-ring sweep is possible without a fold.js change, and one instance cannot have half its gores up | `fold.js:184`, `:345-359`, `config/fold.js:20` |
| Geometry must fit one tile | Book bake: an orthographic 2×2 camera per model, so flat pieces outside the tile are cropped from the page print, and the twin cross-fade is per cell. Walk field: 41×41 samples over the tile only. Base and print are one tile | `book.js:384`, `:416-443`, `world.js:30-31`, `:381-460`, `:1128` |
| WFC has no multi-cell structures | One model per cell, matched only by sockets. It cannot place 49 specific dome pieces in formation. Also the 96-option cap with 95 used | `models.js:41`, `wfc.js:49`, `models.js:64` |
| Loader rejects hinge-less models | A flat "dome plot" filler model needs `base` + ≥1 hinge | `loader.js:335` |
| Name-triggered behaviour | Avoid the `CARD_RX` / `CROSS_RX` / `HOUSE_RX` / `rigid` words in slice names, or the gold pass turns or scales them | §1.5 |
| Shadow frustum | Fitted to the camera footprint, `maxExtent 20`, `far 70`. Probably fine for 8.5-unit flaps **(inferred)** | `config/render.js:44-52`, `lights.js:112-123` |

### 5.4 The minimal hook

**Option A (smallest; recommended if the endless WFC world is being replaced, as `../PROMPT.md:7` says): a standalone
set-piece outside world.js.** fold.js needs no changes, because it only touches node quaternions:

```js
const dome = buildDomeGroup();                 // Group: top-level gores (hinge on the plinth ring), tiers nested above
const fold = createFoldInstance(dome, { tileId: 'dome_a' });   // starts at snap(0)
scene.add(dome);                               // plain meshes: three updates matrices itself (no BatchedMesh)
// each frame:
const d = Math.hypot(trav.x - dome.position.x, trav.z - dome.position.z) - DOME_RADIUS;
if (d < RISE_AT) fold.setTarget(1); else if (d > FOLD_AT) fold.setTarget(0);   // hysteresis: FOLD_AT > RISE_AT
if (!fold.settled) fold.update(dt);
```

The costs: one draw call per mesh, unless the slices are merged per tier into fewer meshes (a nested chain can still
be one mesh per hinge). No book twin, so the flat dome needs its own print on the page or must be authored to read
well folded. No walk field; the traveller's collision needs its own test. Use `assets.materials.paper`; the traveller
already renders plain meshes with this material family (`loader.js:311-314`).

**Option B (inside world.js): a "set-piece record".** About 60 lines:
1. Reserve the covered cells for a flat filler model (WFC pin, or a post-pass in `cellAt`).
2. Add `setPieces[]` records shaped like tile records (`group, fold, meshes, inst, card:null, room:null`), created
   with `createFoldInstance` + `addInstance`, as in `createRecord` (`world.js:589-680`).
3. In `stream()`, compute their distance as `max(0, dist(traveller, centre) - radiusTiles)` and run the same
   pending / `rise()` / fold-back branches (`world.js:1062-1137`), but **never pool them by cell**.

**One fold.js change both options want:** a per-instance stagger span, so tiers sweep up over about 1–2 s instead of
0.34 s.

```js
// fold.js:184  (was: f.tUp = f.delay * S.staggerSpan;)
f.tUp = f.delay * (info.staggerSpan ?? S.staggerSpan);
```

Then use `delay` per ring and per gore (for example `delay = ring/rings * 0.7 + gore/gores * 0.3`). Optionally add a
per-flap `userData.size` override (already honoured, `fold.js:102`). Size cannot exceed the 1.0 clamp, so feel
scaling goes through `stiffness`. **(inferred proposal; not implemented)**

---

## 6. Fold-feel targets (`src/core/config/fold.js:2-4`)

> A flap snaps up in **~0.25 s**, overshoots upright by **8–15 %**, the strut "goes taut" and the card quivers
> **2–3 times (4–7 Hz flutter)** before it is dead still at **0.6–1.1 s**. Fold-down is **softer** and ends with a
> **tiny slap-bounce** on the page. **Large flaps are slower than small ones.**

The header cites `ref/CHECKLIST.md F1–F12`, which is not in the repo or upstream. Only F12 is named in code: "retargets
continuous / never reads as a jerk" (`config/fold.js:34`, `fold.js:315`). The tunables that serve each target:

| Target | Tunables (`config/fold.js`) |
|---|---|
| Rise in about 0.25 s, arriving with speed | `stiffness 62`, `damping 5.0`, `dampingLarge 0.5` (`:9-12`) |
| 8–15 % overshoot, 2–3 cycles at 4–7 Hz | `flutterHz 4.5`, `flutterDamping 0.04`, `flutterDrag 3.5`, `flutterFriction 2.2`, `flutterFrictionLarge 1.8`, `wobble 0.06`, `wobbleLarge 2` (`:27-42`) |
| Not a rigid board | `twist 1.1` (`:44`) |
| Large slower than small | `sizeSmall 0.12`, `sizeLarge 0.7`, `freqSmall 1.14`, `freqLarge 0.88`, `jitter 0.03` (`:47-52`) |
| Soft fold-down, slap-bounce < 3 % | `downStiffness 10`, `downDamping 4.5`, `downPull 5`, `downAnticipation 1.2`, `restitution 0.25`, `minBounceSpeed 0.5` (`:14-18`, `:55-56`) |
| Stagger / nesting | `staggerSpan 0.34`, `nestedLag 0.02`, `nestedStiffness 1500`, `nestedDamping 0.8`, `nestedMaxAccel 125` (`:20-34`) |
| Settled / deterministic | `settleEps 0.002`, `maxStep 1/240`, `maxSubSteps 30` (`:24-26`, `:58`) |

---

## 7. End-to-end proof: `wobble` from the glb to the spring

1. **In the file:** `dump_glb.js` shows the extras `bridge__ramp_n` → `{"hinge":true,"foldAngle":-0.45379,"delay":0.545,"layer":6,"wobble":0.6}`.
2. **Through GLTFLoader:** `prove_wobble.mjs` parses `tiles.glb` with the app's own three/GLTFLoader in Node:
   `userData = {"name":"bridge__ramp_n","hinge":true,"foldAngle":-0.45379,"delay":0.545,"layer":6,"wobble":0.6}`
   (`GLTFLoader.js:2419`, `:4514`). `loader.js adopt()` leaves `wobble` alone (`loader.js:215-221` only touches
   hinge, foldAngle, delay and layer).
3. **Into fold.js:** the script runs the app's `createFoldInstance` on the bridge tile.
   * `fold.js:124` reads `ud.wobble ?? 1` into `wob`, and `fold.js:135` stores `wobble: ud.wobble ?? 1`: flap
     `wobble = 0.6`.
   * `fold.js:146` `cL = 2*(flutterDamping/√wob)*ωL`: **actual cL = 2.9452**, which equals the recomputed value for
     wobble 0.6 (**2.9452**). With wobble 1 it would be **2.2814**. The key changes the latched flutter damping by
     about 29 %.
   * Its nested child `bridge__ramp_n_crown` has no wobble (it gets 1), resolves `parent = bridge__ramp_n` from the
     hierarchy (`fold.js:112-117`), and has `tUp 0.2053 = 0.1853 + nestedLag 0.02` (`fold.js:185`).
   * The angle between `snap(1)` and `snap(0)` for ramp_n is **26.00°**, equal to \|foldAngle\|, which confirms the
     `RotX(foldAngle*(1-p))` pose.

---

## 8. Open questions

1. **World scale:** is 1 unit ≈ 10 ft (traveller-relative, dome ≈ 7 tiles) or 1 unit = 1 ft (BUILD-NOTES, dome = 70
   tiles)? This decides whether the dome fits the reveal, shadow and camera envelopes at all.
2. Does the dome live inside the WFC/tile streamer (option B) or replace it (option A)? `../PROMPT.md` says the
   countryside is replaced, which favours A.
3. **Flat state of the dome:** what should the page show while it is folded? There is no per-cell print for a
   multi-cell piece, and `book.js` bakes one tile per model.
4. **Tier structure:** gores as top-level flaps with ring tiers nested (accordion, small flat footprint), or every
   panel top-level with ring-ordered `delay` (simpler, but its flat footprint is the full gore length)?
5. `ref/CHECKLIST.md` (F1–F12), `tools/blender/*.py` and the original `docs/ARCHITECTURE.md` are missing here and
   upstream. Does anyone have them? The Blender builders would show how slabs, edges, AO and UVs were generated; this
   doc infers that from the output.
6. Does the shadow/depth pass honour the art alpha cut? This assumes it does not; check by rendering a rectangular art
   card in a dev build.
7. `printAtlas` (`paper/print_atlas.png`) is loaded but never used. Is it dead, or reserved for something planned?

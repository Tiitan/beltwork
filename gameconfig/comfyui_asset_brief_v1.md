# Beltwork V1 Asset Generation Brief (ComfyUI)

This brief is written as a prompt letter for a ComfyUI generation workflow.

## 1. Global Art Direction
- Cozy hard-sci-fi, non-threatening, readable at small sizes.
- Style: stylized 2D digital painting, clean silhouette, soft edge highlights.
- Tone: warm, calm, friendly industrial space life.
- Palette: muted steel blue, warm gray, soft teal, amber accents, gentle coral warnings.
- Lighting: soft studio-like top light, mild rim light, no dramatic horror contrast.
- Background: transparent or flat neutral backdrop.
- Composition: centered subject, icon-friendly framing, high readability at 64x64.
- Avoid: grimdark, photorealism, military aggression, weapons, skulls, heavy grime.

## 2. Output Requirements
- Generate square icons at high resolution (recommended 1024x1024), downscale later.
- Keep subject centered with padding for UI crop safety.
- One primary subject per icon.
- Export with transparent background when possible.
- File naming must exactly match the `icon` id values from config.

## 3. Master Prompt Template
Use this base and append the asset-specific line.

`cozy hard sci-fi game icon, stylized 2D digital painting, clean silhouette, soft ambient lighting, readable at small size, centered composition, transparent background, warm and friendly space industry mood`

Negative prompt:

`photorealistic, horror, weapon focus, violence, blood, text, watermark, logo, low contrast, blurry, noisy background, cluttered composition`

## 4. Resource Icons
- `res_water`: a sealed translucent water canister with soft blue liquid, subtle condensation, rounded industrial design.
- `res_metals`: stacked refined metal ingots with rounded corners, brushed steel texture, tiny warm reflection.
- `res_conductors`: bundled copper-gold conductive rods and wire coil, clean polished look, bright conductive glint.
- `res_carbon`: matte black carbon pellets and composite sheets, lightweight texture, subtle blue-gray highlights.
- `cmp_metal_plates`: layered machined metal plates with bolt holes, clean edges, practical industrial finish.
- `cmp_wire_spools`: compact spool of insulated wire, teal and copper accents, neat winding pattern.
- `cmp_polymer_parts`: molded polymer brackets and housings, smooth finish, friendly rounded geometry.
- `cmp_coolant_cells`: compact cylindrical coolant cartridges with pale cyan core glow and safety cap.
- `adv_rig_kits`: organized kit case with mini drill head, clamps, and tool modules, high-tech but cozy.
- `adv_station_parts`: modular station panel with ports and soft indicator lights, sturdy and premium.

## 5. Building Icons
- `bld_fusion_reactor`: compact fusion core unit with circular chamber, soft cyan plasma glow, safe contained design.
- `bld_storage`: cargo bay container cluster with labeled drawers and stacked crates, tidy and practical.
- `bld_life_support`: life-support module with air recycler vents, green status lights, small plant-friendly vibe.
- `bld_scanner_survey`: rotating sensor dish and scanning antenna array, gentle radar arc motif.
- `bld_refinery`: compact refining machine with pipes and separator tank, warm amber process lights.
- `bld_assembler`: precision assembly bench with robotic arm and component tray, friendly utility aesthetic.
- `bld_mining_docks`: docking clamp platform with small mining shuttle cradle, clear mechanical silhouette.
- `bld_radiators`: fold-out radiator fins with cool blue thermal gradient and vent detail.

## 6. Recipe Icons
- `rcp_refine_metal_plates`: process icon showing raw ingot transforming into stacked plate.
- `rcp_refine_wire_spools`: conductor rod feeding into a neat wire spool output.
- `rcp_refine_polymer_parts`: carbon feedstock entering mold press, polymer part emerging.
- `rcp_refine_coolant_cells`: liquid fill process into coolant cartridge, safety seal indicator.
- `rcp_assemble_rig_kits`: grouped components assembled into a rugged toolkit crate.
- `rcp_assemble_station_parts`: mixed industrial parts merging into a clean station module panel.
- `rcp_assemble_emergency_coolant_pack`: emergency coolant package with cross symbol and blue coolant motif.

## 7. Asteroid Icons
- `ast_common_chondrite`: medium rocky asteroid, neutral brown-gray, modest metallic flecks.
- `ast_carbonaceous`: dark porous asteroid with carbon-rich matte surface and icy traces.
- `ast_metal_rich`: dense metallic asteroid with iron sheen and bright reflective seams.
- `ast_conductor_veined`: rock body with visible luminous conductor veins (gold-copper lines).
- `ast_icy_rare`: crystalline icy asteroid with pale cyan highlights and frosted edges.

## 8. Batch Prompt Format
For each asset:
1. Start from the master prompt template.
2. Append exactly one specific asset description line from sections 4-7.
3. Keep the same negative prompt and rendering settings.
4. Save output as `<icon>.png`.

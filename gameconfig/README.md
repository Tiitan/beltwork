# Beltwork Game Config

This folder contains rough balancing data for Beltwork.

Purpose:
- centralize content definitions
- make balancing tunable without rewriting logic
- serve as a reference baseline for iteration

Conventions:
- all values are draft numbers
- times are in seconds
- masses are in kilograms
- volumes are in cubic meters
- power is in kW
- heat is in heat-units per second (abstract)

Files:
- `resources.json`: item/resource catalog
- `buildings.json`: station building definitions and scaling
- `blueprints.json`: production graph definitions
- `asteroids.json`: asteroid template catalog and mining balancing inputs
- `map.json`: shared world map bounds and spawn constraints

Notes:
- There is no market simulation yet; `base_value_credits` is reference-only.
- Use this data for backend simulation math and frontend labels/icons.
- Asteroid config defines templates only. Runtime asteroid instances carry positions and depletion state.
- World map generation implementation is intentionally deferred; this folder defines schema/contracts only.

## Icon generation

Per-icon visual text is stored in each config entry as `icon_visual_description`.
Each asset family config also defines:
- `icon_master_prompt`: family-level master prompt
- `icon_output_background`: family-level output background mode (`transparent` or `opaque`)

The batch generator reads these fields directly from each config file.

```bash
npm run assets:generate -- -- --dry-run
```

Default provider: `comfyui`.

Generate all icon PNGs (30 files) with ComfyUI:

```powershell
$env:COMFYUI_CHECKPOINT="your_checkpoint.safetensors"
npm run assets:generate
```

Generate with OpenAI provider:

```powershell
$env:OPENAI_API_KEY="your_key_here"
npm run assets:generate -- -- --provider openai
```

Defaults:
- output folder: `apps/web/public/assets/icons`
- category folders: `ressources`, `buildings`, `blueprints`, `asteroids`
- size: `1024x1024`
- provider: `comfyui`
- ComfyUI URL: `http://127.0.0.1:8188`

Useful options:

```bash
npm run assets:generate -- -- --only res_water,bld_refinery
npm run assets:generate -- -- --limit 5
npm run assets:generate -- -- --size 1536x1536
npm run assets:generate -- -- --out-dir gameconfig/generated/icons
npm run assets:generate -- -- --rebuild-all
npm run assets:generate -- -- --provider openai --model gpt-image-1 --background transparent
```

## Generation record

Last full icon batch was generated with:
- provider: `comfyui`
- checkpoint: `zavychromaxl_v80.safetensors`
- comfyui endpoint used: `http://192.168.1.224:8188`

Command used:

```bash
npm run assets:generate -- -- --provider comfyui --comfy-url http://192.168.1.224:8188 --comfy-checkpoint zavychromaxl_v80.safetensors
```

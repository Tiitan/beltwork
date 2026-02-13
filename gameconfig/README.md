# Beltwork Game Config (V1 Draft)

This folder contains rough balancing data for Beltwork V1.

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
- `resources.v1.json`: item/resource catalog
- `buildings.v1.json`: station building definitions and scaling
- `recipes.v1.json`: production graph definitions
- `asteroids.v1.json`: asteroid template catalog and mining balancing inputs
- `map.v1.json`: shared world map bounds and spawn constraints

Notes:
- V1 has no market simulation yet; `base_value_credits` is reference-only.
- Use this data for backend simulation math and frontend labels/icons.
- Asteroid config defines templates only. Runtime asteroid instances carry positions and depletion state.
- World map generation implementation is intentionally deferred; this folder defines schema/contracts only.

# ML Experiments Pipeline

Node.js exports features from the same logic used in production (`extractFeatures` / rule engine).
Python trains and compares models; results land in `experiments/results/`.

## Quick start

```bash
# 1. Export features (benchmark)
npm run export:features

# 2. Optional: generate synthetic prescriptions (n=500)
npm run generate:synth-prescriptions

# 3. Re-export from synthetic data
node scripts/export_features.js --input experiments/data/tcm/synth_n500.json --out experiments/data/tcm/features_synth.csv

# 4. Python env
pip install -r experiments/tcm/requirements.txt

# 5. Train
python experiments/tcm/train.py --data experiments/data/tcm/features_v1.csv --model xgb --cv 5 --seed 42

# 6. Summarize
python experiments/tcm/evaluate.py --results experiments/results --out experiments/results/summary.csv
```

## Feature columns

From `server/config/ml-weights.json`: herb_count_norm, dosage flags, 18fan/19wei, licorice ratio, age flags, warm_cold_mix.

## Output layout

```
experiments/
  data/tcm/features_v1.csv
  data/tcm/synth_n500.json
  results/<exp-id>.json
  results/summary.csv
  tcm/train.py
  tcm/evaluate.py
  tcm/notebooks/tcm_experiments.ipynb
```

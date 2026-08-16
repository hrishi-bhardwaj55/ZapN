# Scoring

All combined values are **Practice Scores**, not employer scores, percentiles, or pass cutoffs. They are simulator heuristics in the inclusive range 0–100.

The shared default heuristic weights accuracy at 72% and speed at up to 28%, with the speed component decreasing as median reaction time increases. Game-specific engines may supply a more meaningful heuristic:

| Game | Primary raw measures | Practice heuristic emphasis |
|---|---|---|
| Balloon | Banked value, pumps, bursts | Earnings and risk calibration |
| Skyscraper | Actual vs optimal moves, invalid moves | Planning efficiency |
| Shapeshift | Accuracy, median RT, anticipations | Rule accuracy before speed |
| Code Compare | Accuracy, median RT, code length | Exact discrimination |
| Pincode | Accuracy, span, transformation | Working-memory span |
| Number Box | Solve rate, solve time, validity | Constraint-correct solving |
| Figure It Out | Guesses, information gain, repeats | Information efficiency |
| The Switch | Switch/repeat RT and accuracy | Accuracy and switch cost |
| Stock Master | Hits, angular error, early/late | Timing precision |

Median reaction time is emphasized because extreme response times skew the mean. Both values remain stored. Attempts with different `configVersion` values should not be treated as directly comparable without noting the rule change.

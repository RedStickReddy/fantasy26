# 2026 projection data audit

Audit date: 2026-09-05

## Verdict

The original `nfl_fantasy_draft_projections_2026.csv` is synthetic test data and should not be used for draft decisions. The web page no longer loads it.

## Findings

- 544 rows followed an artificial pattern of exactly 17 entries for each of 32 teams.
- Only 160 unique named players were present.
- 160 rows used fabricated placeholders such as `RB Depth 3` and `WR Depth 5`.
- Real players were repeated on unrelated teams with different projections.
- Of 121 unique players matched to ESPN's current NFL feed, 118 had a team mismatch in at least one CSV occurrence.
- Examples included Josh Allen assigned to Philadelphia instead of Buffalo, Christian McCaffrey assigned to Washington instead of San Francisco, and Travis Kelce assigned to Arizona instead of Kansas City.
- Several projections were internally implausible, including zero-value players and touchdown/yard combinations that did not reconcile.

## Corrected page source

The page now loads live 2026 data from ESPN Fantasy Football:

- Player projections and injury designations: https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/players?scoringPeriodId=0&view=kona_player_info
- Official team mapping: https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026?view=proTeamSchedules_wl

The application keeps active QB, RB, WR, TE, and K players assigned to an NFL team and having a positive weekly projection. It derives one unique row per ESPN player, eliminating the original duplicates and placeholders.

## Scoring and derived fields

The selected format is PPR:

- Passing yards: 0.04 points per yard
- Passing touchdowns: 4 points
- Interceptions: -2 points
- Rushing/receiving yards: 0.1 points per yard
- Rushing/receiving touchdowns: 6 points
- Receptions: 1 point
- Kicker field goals: 3/4/5 points by distance tier; extra points: 1 point

Projected points, touchdowns, and yards are summed from ESPN's weekly 2026 projections. Overall rank is descending projected PPR points. Depth rank and role are derived within each actual team and position. Questionable status comes from ESPN's current player designation.

## Caveat

Projections and injury designations change during the season. Refreshing the page obtains the latest values available from ESPN; they are estimates, not guarantees.

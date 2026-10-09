# Gerenciador de Jornada v1

`page.tsx` delegates to the DPO view and this feature. The API module owns the
authenticated GET contract, the model owns query and response types, the lib
owns presentation-only grouping and formatting, and the UI renders each map
with its crew. Only the backend supplies official durations, targets, states,
outcomes and expurge flags.

The default query loads the current date and every map, role and expurge state.
Date and filter controls apply to the loaded period. The live counter adds
elapsed wall time to an open indicator's official seconds using its snapshot;
the official target status and outcome remain those of the last snapshot.
When a visible query contains an indicator in progress, a silent API refresh
updates the snapshot about every 60 seconds. The page pauses automatic refresh
while hidden and while no loaded row is live. A failed refresh preserves the
last data; query changes abort the old request. Manual refresh remains available.

TR is presented once per map, with crew rows listed as context. The current
backend contract has no BEES delivery progress (IFW-29); no progress is
inferred. Expurge belongs to each crew member and is never inferred for the
whole map from its first row. TML, TI and JL show their official fields and
timestamps without recomputing KPI values. Period navigation supports historical lists. The page does not
choose a hidden window for earlier pending maps. When `mapOrigin` explicitly
equals `LIVE`, the loaded period can be narrowed to today's D0 maps or earlier
pending maps; other origins are not classified as pending.

## Analytical view

The indicator card switches between Acompanhamento and Análise without changing
the shared date, search or filters. Análise uses authenticated
`/api/v1/journey/history/{indicator}` and feature-local Apache ECharts (SVG).
No yearly raw map list is loaded while the analytical view is active.

The compact backend contract supplies official closed-result counts, selected
summary and collaborators, contextual daily counts and prior-year counts. Only
closed evaluable `achieved` results enter adherence. Open and unavailable rows
are visible separately; NULL adherence is a chart gap, never a zero. Percentages
are rolled up using summed attained/evaluated counts, not the average of rates.

Drivers are the default analytical population. Helpers can be selected unless
the shared role filter locks the population. TR and operational JL count maps
once in summaries, whereas individual indicators preserve map–person results.
Collaborator charts always show each person's maps in the exact selection.

Weekly charts cover Monday–Saturday around the selection, even across months.
Up to three weeks show days and separate accumulated weekly series. Larger
selections use actual calendar month/week intersections (including six where
necessary), with no duplicate boundary dates. A single selected month shows
daily monthly progression; multiple months show one point per calendar month.
Weekly and monthly context can include dates outside the exact selection and
is labelled accordingly. Monthly results include Sundays; weekly results do not.
Annual comparison aligns partial current months with the same prior-year dates.

Search is applied without confirmation (300ms network debounce). Query/mode
changes abort old reads. Only a visible analytical selection with pending
results polls silently; it reuses prior-year history for that exact filter key.
Failed refreshes retain previous data with an explicit notice. Changing filters
never relabels stale data. Native controls and chart palettes follow the app
theme; chart data is also available through expandable tables.

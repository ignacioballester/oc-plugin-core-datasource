# Base function library, prepended to every panel source by the datasource.
# These resolve build_grid / cumulative_twr / cumulative_to_period_returns /
# window / pl from the compute-injected namespace at call time. No decorators.

def over_time(fn, step):
    """Evaluate fn(t) over a uniform grid spanning the dashboard window.

    fn:   given cutoff ts t (epoch microseconds), returns the metric value as of
          t (float or None). fn owns its windowing (expanding: ts <= t).
    step: int microseconds or a string like "1d" / "1h".
    Returns pl.DataFrame({"ts": Int64, "value": Float64}) over [window.t0,
    window.t1] inclusive; ts is Int64 epoch-microseconds.
    """
    grid = build_grid(window.t0, window.t1, step)
    return pl.DataFrame(
        {"ts": grid, "value": [fn(t) for t in grid]},
        schema={"ts": pl.Int64, "value": pl.Float64},
    )


def returns(nav, flows, step):
    """Flow-neutralized period-return series for a portfolio on a step grid.

    nav:   e_nav frame (ts Int64 µs, value Float64 > 0).
    flows: e_flows frame (ts Int64 µs, amt Float64 signed).
    Returns pl.DataFrame({"ts": Int64, "ret": Float64}); first tick ret is null.
    """
    t0, t1 = window
    start = t0 if nav.is_empty() else max(t0, nav["ts"][0])
    flow_ts = [r[0] for r in flows.select("ts").rows() if r[0] > start]
    grid = build_grid(start, t1, step)
    cum = cumulative_twr(nav, flow_ts, start, grid)
    pairs = cumulative_to_period_returns(cum)
    return pl.DataFrame(
        {"ts": [ts for ts, _ in pairs], "ret": [r for _, r in pairs]},
        schema={"ts": pl.Int64, "ret": pl.Float64},
    )

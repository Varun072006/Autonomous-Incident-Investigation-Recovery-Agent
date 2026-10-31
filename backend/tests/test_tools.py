"""Tests for 12 diagnostic tools, outage handling, and scenario literal absence."""
import inspect
import pytest
from app import seed, tools


@pytest.fixture(scope="module", autouse=True)
def setup_seed():
    seed.run()


def test_all_12_tools_registered():
    expected_tools = [
        "get_alerts", "get_deployments", "get_config_changes", "detect_anomalies",
        "localize_origin", "search_logs", "trace_breakdown", "errors_by_version",
        "get_pool_metrics", "get_db_metrics", "search_tickets", "find_similar_incidents"
    ]
    for t_name in expected_tools:
        assert t_name in tools.TOOL_REGISTRY, f"Tool {t_name} missing from TOOL_REGISTRY"


def test_tools_return_resolvable_references():
    for name, func in tools.TOOL_REGISTRY.items():
        res = tools.run_tool(name)
        assert res["tool"] == name
        assert "summary" in res
        assert "observations" in res
        for obs in res["observations"]:
            assert "text" in obs
            assert "ts" in obs
            assert "refs" in obs
            for r in obs["refs"]:
                assert "table" in r
                assert "ids" in r


def test_pool_metrics_shows_pinned_saturation():
    res = tools.run_tool("get_pool_metrics")
    obs = res["observations"][0]
    assert obs["data"]["pool_active"] == 10.0
    assert obs["data"]["pool_max"] == 10.0
    assert obs["data"]["saturation_pct"] == 100.0


def test_errors_by_version_within_tolerance():
    res = tools.run_tool("errors_by_version")
    rates = [o["data"]["error_rate_pct"] for o in res["observations"] if "error_rate_pct" in o["data"]]
    assert len(rates) >= 2
    diff = abs(rates[0] - rates[1])
    assert diff <= 3.0, f"Version error rate diff {diff} exceeds threshold"


def test_db_metrics_healthy():
    res = tools.run_tool("get_db_metrics")
    obs = res["observations"][0]
    assert obs["data"]["avg_cpu_pct"] < 30.0
    assert obs["data"]["query_p95_ms"] < 30.0
    assert obs["data"]["slow_queries"] == 0


def test_localize_origin():
    res = tools.run_tool("localize_origin")
    assert len(res["observations"]) > 0
    origin = res["observations"][0]["data"]["origin_service"]
    assert origin == "payment-service"


def test_tool_outage_simulation():
    tools.set_tool_outage("get_pool_metrics", True)
    try:
        res = tools.run_tool("get_pool_metrics")
        assert res.get("error") == "TOOL_OUTAGE"
        assert "unavailable" in res["summary"]
    finally:
        tools.set_tool_outage("get_pool_metrics", False)


def test_no_scenario_literals_in_tools_file():
    with open(inspect.getfile(tools), "r", encoding="utf-8") as f:
        src = f.read()

    forbidden_literals = [
        "CHG-4821", "INC-0198", "orders-db", "payment-service",
        "checkout-api", "inventory-service"
    ]
    for lit in forbidden_literals:
        assert lit not in src, f"Forbidden scenario literal '{lit}' found in tools.py!"


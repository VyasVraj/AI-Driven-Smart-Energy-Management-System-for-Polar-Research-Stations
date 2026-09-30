import sys, os
os.environ["PYTHONUTF8"] = "1"
sys.path.insert(0, '.')

errors = []

# Test RAG Knowledge Base
try:
    from app.rag.polar_knowledge_base import PolarKnowledgeBase
    kb = PolarKnowledgeBase()
    cats = kb.get_all_categories()
    doc_count = kb.document_count
    results = kb.retrieve("blizzard emergency protocol fuel", top_k=2)
    print(f"[PASS] PolarKnowledgeBase: {doc_count} docs, {len(cats)} categories")
    print(f"       Top result: '{results[0]['document']['title']}' (score={results[0]['relevance_score']:.2f})")
except Exception as e:
    print(f"[FAIL] PolarKnowledgeBase: {e}")
    errors.append("knowledge_base")

# Test RAG Advisor
try:
    from app.rag.rag_advisor import RAGAdvisor
    rag = RAGAdvisor()
    mock_telemetry = {
        "fuel_level_pct": 18.0,
        "battery_soc_pct": 42.0,
        "solar_kw": 0.0,
        "wind_kw": 85.0,
        "diesel_kw": 120.0,
        "total_load_kw": 205.0,
        "temperature_c": -31.0,
        "wind_speed_kmh": 95.0,
        "renewable_pct": 41.5,
    }
    result = rag.answer("What does the blizzard emergency protocol say?", mock_telemetry)
    print(f"[PASS] RAGAdvisor: confidence={result['confidence']:.2f} | rag_used={result['rag_context_used']}")
    print(f"       Sources: {[s['title'] for s in result['sources'][:2]]}")
    print(f"       Actions: {len(result['action_items'])} items")
except Exception as e:
    print(f"[FAIL] RAGAdvisor: {e}")
    errors.append("rag_advisor")

# Test MPC API (import only)
try:
    from app.api.mpc import router as mpc_router
    routes = [r.path for r in mpc_router.routes]
    print(f"[PASS] MPC API router: {len(routes)} routes -> {routes}")
except Exception as e:
    print(f"[FAIL] MPC API: {e}")
    errors.append("mpc_api")

# Test Load Shedding API (import only)
try:
    from app.api.load_shedding import router as ls_router
    routes = [r.path for r in ls_router.routes]
    print(f"[PASS] LoadShedding API: {len(routes)} routes -> {routes}")
except Exception as e:
    print(f"[FAIL] LoadShedding API: {e}")
    errors.append("load_shedding_api")

print()
if errors:
    print(f"[SUMMARY] {len(errors)} failure(s): {', '.join(errors)}")
else:
    print("[SUMMARY] ALL RAG + API MODULES PASSED!")

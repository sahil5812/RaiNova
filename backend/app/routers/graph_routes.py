from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from app.models.schemas import CascadingGraphResponse
from app.models.graph_engine import MumbaiInfrastructureGraph
from app.models.flood_model import MumbaiFloodModel
from app.data.mumbai_data_loader import load_master_infrastructure

router = APIRouter(prefix="/api/graph", tags=["Infrastructure Graph & Routing"])
routes_router = APIRouter(prefix="/api/routes", tags=["Coordinate-Based Routing"])

class SafeRouteRequest(BaseModel):
    start: List[float]  # [longitude, latitude]
    destination: List[float]  # [longitude, latitude]
    rainfall_mm_hr: float = 85.0
    tide_level_m: float = 3.5
    siltation_pct: float = 35.0

infra = load_master_infrastructure()
graph_engine = MumbaiInfrastructureGraph()
flood_model = MumbaiFloodModel()

def init_graph():
    all_nodes = infra["hotspots"] + infra["roads"] + infra["drains"] + infra["pumping_stations"]
    graph_engine.build_graph(all_nodes, infra["edges"])

init_graph()

@router.get("/cascading-topology", response_model=CascadingGraphResponse)
def get_cascading_topology():
    init_graph()
    cascade_res = graph_engine.propagate_cascading_failures(failure_threshold_risk=50.0)
    g_dict = graph_engine.get_graph_dict()
    
    return CascadingGraphResponse(
        nodes=g_dict["nodes"],
        edges=g_dict["edges"],
        active_cascade_chains=cascade_res["cascade_chains"],
        total_impacted_nodes=cascade_res["total_impacted_nodes"]
    )

def resolve_node_id(node_query: str, available_nodes: set) -> str:
    if node_query in available_nodes:
        return node_query
    
    aliases = {
        "WL_AND_01": "WLS_AND_04",
        "HOT_AND_01": "WLS_AND_04",
        "ANDHERI": "WLS_AND_04",
        "WL_HND_01": "WLS_HND_01",
        "HOT_HND_01": "WLS_HND_01",
        "HINDMATA": "WLS_HND_01",
        "WL_MLN_01": "WLS_MLN_03",
        "HOT_MLN_01": "WLS_MLN_03",
        "MILAN": "WLS_MLN_03",
        "WL_KRL_01": "WLS_KRL_06",
        "HOT_KRL_01": "WLS_KRL_06",
        "KURLA": "WLS_KRL_06",
        "MARINE_DRIVE": "RD_MDR_01",
        "BANDRA": "RD_WEH_01",
        "BORIVALI": "RD_WEH_04"
    }
    cleaned = node_query.upper().replace(" ", "_")
    if cleaned in aliases and aliases[cleaned] in available_nodes:
        return aliases[cleaned]
    
    for nid in available_nodes:
        if node_query.lower() in nid.lower():
            return nid
            
    return node_query

@router.get("/safe-route")
def get_flood_safe_route(
    origin: str = Query("RD_MDR_01", description="Origin Node ID (e.g. Marine Drive)"),
    destination: str = Query("WL_AND_01", description="Destination Node ID (e.g. Andheri Subway)"),
    rainfall_mm_hr: float = Query(150.0, description="Current Rainfall Intensity (mm/h)"),
    tide_level_m: float = Query(3.5, description="Current Arabian Sea Tide Level (m)"),
    siltation_pct: float = Query(35.0, description="Drainage Siltation Level (%)")
):
    """
    Flood-Safe Emergency Routing API:
    Suggests alternative navigation routes that dynamically bypass submerged subways and gridlocked corridors
    based on physics-informed hydrodynamic inundation modeling.
    """
    init_graph()
    depth_map = {}

    # Calculate dynamic inundation depth for all hotspots and roads
    for node in infra.get("hotspots", []) + infra.get("roads", []):
        node_id = str(node.get("id", ""))
        c_type = node.get("type", "HOTSPOT")
        elev = float(node.get("elevation_m", 2.5))
        name = str(node.get("name", ""))
        hist_depth = float(node.get("historical_avg_depth_cm", 50.0))

        flood_res = flood_model.calculate_inundation_depth(
            rainfall_mm_hr=rainfall_mm_hr,
            tide_level_m=tide_level_m,
            elevation_m=elev,
            siltation_pct=siltation_pct,
            component_type=c_type,
            name=name,
            historical_avg_depth=hist_depth
        )
        calc_depth = flood_res.get("water_depth_cm", 0.0)
        depth_map[node_id] = round(calc_depth, 1)

        # Also support legacy alias IDs for backwards compatibility
        if "HND" in node_id or "Hindmata" in name:
            depth_map["WL_HND_01"] = round(calc_depth, 1)
            depth_map["HOT_HND_01"] = round(calc_depth, 1)
        elif "MLN" in node_id or "Milan" in name:
            depth_map["WL_MLN_01"] = round(calc_depth, 1)
            depth_map["HOT_MLN_01"] = round(calc_depth, 1)
        elif "AND" in node_id or "Andheri" in name:
            depth_map["WL_AND_01"] = round(calc_depth, 1)
            depth_map["HOT_AND_01"] = round(calc_depth, 1)
        elif "KRL" in node_id or "Kurla" in name:
            depth_map["WL_KRL_01"] = round(calc_depth, 1)
            depth_map["HOT_KRL_01"] = round(calc_depth, 1)

    available_nodes = set(graph_engine.road_graph.nodes())
    resolved_origin = resolve_node_id(origin, available_nodes)
    resolved_dest = resolve_node_id(destination, available_nodes)

    route_result = graph_engine.calculate_safe_route(resolved_origin, resolved_dest, depth_map)
    route_result["origin"] = origin
    route_result["destination"] = destination
    return route_result

@routes_router.post("/safe")
def post_coordinate_safe_route(req: SafeRouteRequest):
    """
    Coordinate-based flood-safe routing:
    Accepts [lng, lat] coordinates, snaps to nearest road graph nodes,
    and computes the Dijkstra flood-safe route with risk-colored segments.
    """
    init_graph()
    
    # 1. Find nearest graph nodes to the input coordinates
    origin_node, origin_dist, _ = graph_engine.find_nearest_road_node(req.start[0], req.start[1])
    dest_node, dest_dist, _ = graph_engine.find_nearest_road_node(req.destination[0], req.destination[1])
    
    # 2. Build flood depth map (same logic as existing safe-route endpoint)
    depth_map = {}
    for node in infra.get("hotspots", []) + infra.get("roads", []):
        node_id = str(node.get("id", ""))
        c_type = node.get("type", "HOTSPOT")
        elev = float(node.get("elevation_m", 2.5))
        name = str(node.get("name", ""))
        hist_depth = float(node.get("historical_avg_depth_cm", 50.0))
        
        flood_res = flood_model.calculate_inundation_depth(
            rainfall_mm_hr=req.rainfall_mm_hr,
            tide_level_m=req.tide_level_m,
            elevation_m=elev,
            siltation_pct=req.siltation_pct,
            component_type=c_type,
            name=name,
            historical_avg_depth=hist_depth
        )
        calc_depth = flood_res.get("water_depth_cm", 0.0)
        depth_map[node_id] = round(calc_depth, 1)
        
        # Legacy alias support
        if "HND" in node_id or "Hindmata" in name:
            depth_map["WL_HND_01"] = round(calc_depth, 1)
        elif "MLN" in node_id or "Milan" in name:
            depth_map["WL_MLN_01"] = round(calc_depth, 1)
        elif "AND" in node_id or "Andheri" in name:
            depth_map["WL_AND_01"] = round(calc_depth, 1)
        elif "KRL" in node_id or "Kurla" in name:
            depth_map["WL_KRL_01"] = round(calc_depth, 1)
    
    # 3. Calculate multi-route alternatives with real road network geometry and flood safety scoring
    result = graph_engine.calculate_multi_safe_routes(
        start_coord=req.start,
        dest_coord=req.destination,
        depth_map=depth_map,
        hotspots_list=infra.get("hotspots", [])
    )
    return result

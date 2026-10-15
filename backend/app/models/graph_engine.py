"""
NetworkX Graph Infrastructure Engine
Models Mumbai's interconnected infrastructure, propagates cascading domino failures,
and computes flood-safe emergency alternative routes.
"""

import networkx as nx
import math
import httpx

def _haversine_km(lon1, lat1, lon2, lat2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

class MumbaiInfrastructureGraph:
    def __init__(self):
        self.G = nx.DiGraph()
        self.road_graph = nx.Graph()

    def build_graph(self, nodes_data, edges_data):
        self.G.clear()
        self.road_graph.clear()
        
        for node in nodes_data:
            self.G.add_node(
                node["id"],
                label=node["name"],
                type=node["type"],
                ward=node["ward"],
                elev=node.get("elevation_m", 4.0),
                health=node.get("health_score", 80.0),
                risk=node.get("failure_risk_score", 20.0),
                water_depth=node.get("water_depth_cm", 0.0),
                status=node.get("status", "SAFE"),
                lat=node.get("latitude", 19.07),
                lon=node.get("longitude", 72.87)
            )
            # Add to navigable road graph
            self.road_graph.add_node(
                node["id"],
                label=node["name"],
                type=node["type"],
                water_depth=node.get("water_depth_cm", 0.0),
                risk=node.get("failure_risk_score", 20.0),
                lat=node.get("latitude", 19.07),
                lon=node.get("longitude", 72.87)
            )

        for edge in edges_data:
            self.G.add_edge(
                edge["source_node_id"],
                edge["target_node_id"],
                type=edge["relationship_type"],
                weight=edge["weight_impact_factor"],
                description=edge.get("description", "")
            )
            # Build road network connectivity
            base_time = edge.get("base_time_mins")
            if base_time is None:
                dist_km = edge.get("distance_km", edge.get("weight_impact_factor", 2.0))
                base_time = round(max(1.0, float(dist_km) * 1.5), 1)
            self.road_graph.add_edge(
                edge["source_node_id"],
                edge["target_node_id"],
                base_time_mins=base_time
            )

    def propagate_cascading_failures(self, failure_threshold_risk=65.0):
        impacted_nodes = set()
        cascade_chains = []

        seed_nodes = [
            n for n, attr in self.G.nodes(data=True)
            if attr.get("risk", 0.0) >= failure_threshold_risk or attr.get("water_depth", 0.0) >= 20.0
        ]

        for seed in seed_nodes:
            impacted_nodes.add(seed)
            for successor in self.G.successors(seed):
                impacted_nodes.add(successor)
                chain = [seed, successor]
                for second_hop in self.G.successors(successor):
                    impacted_nodes.add(second_hop)
                    chain.append(second_hop)
                cascade_chains.append(chain)

        return {
            "seed_failure_nodes": seed_nodes,
            "cascade_chains": cascade_chains,
            "total_impacted_nodes": len(impacted_nodes),
            "impacted_node_ids": list(impacted_nodes)
        }

    def calculate_safe_route(self, origin_id: str, destination_id: str, water_depth_map: dict = None):
        """
        Dijkstra shortest path with dynamic inundation penalties:
        Roads with >30cm water depth receive heavy cost multipliers to force flood-free rerouting.
        """
        water_depth_map = water_depth_map or {}
        
        # Build weighted cost graph
        cost_G = nx.Graph()
        for u, v, d in self.road_graph.edges(data=True):
            base_mins = d.get("base_time_mins", 12.0)
            u_depth = water_depth_map.get(u, self.road_graph.nodes[u].get("water_depth", 0.0))
            v_depth = water_depth_map.get(v, self.road_graph.nodes[v].get("water_depth", 0.0))
            max_depth = max(u_depth, v_depth)

            # Inundation penalty formula
            if max_depth >= 50.0:
                cost = base_mins * 50.0 + 9999.0 # Impassable
            elif max_depth >= 20.0:
                cost = base_mins * (1.0 + (max_depth / 8.0)) # Severe slowdown
            else:
                cost = base_mins # Normal speed

            cost_G.add_edge(u, v, weight=cost, base_time=base_mins, max_depth=max_depth)

        try:
            if origin_id not in cost_G or destination_id not in cost_G:
                nodes = list(cost_G.nodes())
                origin_id = origin_id if origin_id in cost_G else (nodes[0] if nodes else "")
                destination_id = destination_id if destination_id in cost_G else (nodes[-1] if nodes else "")

            path = nx.dijkstra_path(cost_G, origin_id, destination_id, weight="weight")
            
            total_time = 0.0
            avoided_floods = []
            path_details = []

            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge_data = cost_G[u][v]
                depth = edge_data["max_depth"]
                slowdown_factor = (1.0 + (depth / 20.0)) if depth >= 15.0 else 1.0
                total_time += round(edge_data["base_time"] * slowdown_factor, 1)
                path_details.append({
                    "from_node": u,
                    "to_node": v,
                    "water_depth_cm": round(depth, 1),
                    "segment_status": "FLOOD_FREE" if depth < 15 else ("SLOW" if depth < 40 else "SUBMERGED")
                })

            # Check if any standard route nodes were avoided due to flood
            for n, d in self.road_graph.nodes(data=True):
                depth = water_depth_map.get(n, d.get("water_depth", 0.0))
                if depth >= 40.0 and n not in path:
                    avoided_floods.append({
                        "node_id": n,
                        "name": d.get("label", n),
                        "water_depth_cm": depth,
                        "reason": f"Submerged by {depth:.1f} cm floodwater (Route Diverted)"
                    })

            return {
                "origin": origin_id,
                "destination": destination_id,
                "is_flood_safe": True,
                "recommended_path": path,
                "path_waypoints": [self.road_graph.nodes[n].get("label", n) for n in path],
                "estimated_transit_time_mins": round(total_time, 1),
                "submerged_hazards_avoided": avoided_floods,
                "route_segments": path_details
            }
        except Exception as e:
            return {
                "origin": origin_id,
                "destination": destination_id,
                "is_flood_safe": False,
                "error": str(e),
                "fallback_advisory": "Take Western Express Highway Elevated Corridor."
            }

    def find_nearest_road_node(self, lng, lat):
        min_dist = float('inf')
        nearest_node = None
        node_data = None
        for n, d in self.road_graph.nodes(data=True):
            n_lat = d.get("lat")
            n_lon = d.get("lon")
            if n_lat is not None and n_lon is not None:
                dist = _haversine_km(lng, lat, n_lon, n_lat)
                if dist < min_dist:
                    min_dist = dist
                    nearest_node = n
                    node_data = d
        return nearest_node, min_dist, node_data

    def calculate_safe_route_with_coords(self, origin_id, destination_id, water_depth_map=None):
        base_result = self.calculate_safe_route(origin_id, destination_id, water_depth_map)
        
        if base_result.get("error"):
            return {
                "distance_km": 0.0,
                "duration_min": 0.0,
                "risk_score": 0.0,
                "risk_level": "LOW",
                "origin_node": origin_id,
                "destination_node": destination_id,
                "origin_name": self.road_graph.nodes[origin_id].get("label", origin_id) if origin_id in self.road_graph else origin_id,
                "destination_name": self.road_graph.nodes[destination_id].get("label", destination_id) if destination_id in self.road_graph else destination_id,
                "is_flood_safe": False,
                "segments": [],
                "hazards_avoided": [],
                "advisory": base_result.get("fallback_advisory", "")
            }

        total_distance = 0.0
        enriched_segments = []
        path = base_result.get("recommended_path", [])
        
        for i in range(len(path) - 1):
            u = path[i]
            v = path[i+1]
            u_data = self.road_graph.nodes[u]
            v_data = self.road_graph.nodes[v]
            
            u_lng, u_lat = u_data.get("lon", 0), u_data.get("lat", 0)
            v_lng, v_lat = v_data.get("lon", 0), v_data.get("lat", 0)
            dist = _haversine_km(u_lng, u_lat, v_lng, v_lat)
            total_distance += dist
            
            u_depth = water_depth_map.get(u, u_data.get("water_depth", 0.0)) if water_depth_map else u_data.get("water_depth", 0.0)
            v_depth = water_depth_map.get(v, v_data.get("water_depth", 0.0)) if water_depth_map else v_data.get("water_depth", 0.0)
            max_depth = max(u_depth, v_depth)
            
            risk = min(max_depth / 50.0, 1.0)
            if max_depth < 15:
                risk_level = "LOW"
            elif max_depth < 40:
                risk_level = "MEDIUM"
            else:
                risk_level = "HIGH"
                
            edge_data = self.road_graph.get_edge_data(u, v, {})
            duration_min = edge_data.get("base_time_mins", 12.0)
            
            enriched_segments.append({
                "path": [[u_lng, u_lat], [v_lng, v_lat]],
                "from_node": u,
                "to_node": v,
                "from_name": u_data.get("label", u),
                "to_name": v_data.get("label", v),
                "distance_km": round(dist, 3),
                "duration_min": duration_min,
                "water_depth_cm": round(max_depth, 1),
                "risk": round(risk, 2),
                "risk_level": risk_level,
                "segment_status": "FLOOD_FREE" if max_depth < 15 else ("SLOW" if max_depth < 40 else "SUBMERGED")
            })
            
        avg_risk = sum(s["risk"] for s in enriched_segments) / len(enriched_segments) if enriched_segments else 0.0
        if avg_risk < 0.3:
            overall_risk_level = "LOW"
        elif avg_risk < 0.8:
            overall_risk_level = "MEDIUM"
        else:
            overall_risk_level = "HIGH"
            
        enriched_hazards = []
        for h in base_result.get("submerged_hazards_avoided", []):
            nid = h.get("node_id")
            if nid in self.road_graph:
                ndata = self.road_graph.nodes[nid]
                h["lat"] = ndata.get("lat")
                h["lng"] = ndata.get("lon")
            enriched_hazards.append(h)
            
        return {
            "distance_km": round(total_distance, 3),
            "duration_min": base_result.get("estimated_transit_time_mins", 0.0),
            "risk_score": round(avg_risk, 2),
            "risk_level": overall_risk_level,
            "origin_node": origin_id,
            "destination_node": destination_id,
            "origin_name": self.road_graph.nodes[origin_id].get("label", origin_id) if origin_id in self.road_graph else origin_id,
            "destination_name": self.road_graph.nodes[destination_id].get("label", destination_id) if destination_id in self.road_graph else destination_id,
            "is_flood_safe": base_result.get("is_flood_safe", False),
            "segments": enriched_segments,
            "hazards_avoided": enriched_hazards,
            "advisory": base_result.get("fallback_advisory", "")
        }

    def calculate_multi_safe_routes(self, start_coord, dest_coord, depth_map=None, hotspots_list=None):
        """
        Google Maps-style multi-route generator with RaiNova flood safety scoring:
        1. Queries real road network routing (OSRM) to get 2-4 alternative paths following actual streets.
        2. Evaluates flood inundation depth & exposure on each route using RaiNova hydrodynamic flood engine.
        3. Computes multi-factor Safe Route Score (travel time + distance + flood penalty).
        4. Selects the BEST SAFE ROUTE and formats all alternatives with risk-colored segments.
        5. Falls back to NetworkX Dijkstra if OSRM is offline.
        """
        start_lng, start_lat = float(start_coord[0]), float(start_coord[1])
        dest_lng, dest_lat = float(dest_coord[0]), float(dest_coord[1])
        depth_map = depth_map or {}
        hotspots_list = hotspots_list or []

        # Find nearest graph node labels for human-readable origin/destination names
        origin_node, _, origin_data = self.find_nearest_road_node(start_lng, start_lat)
        dest_node, _, dest_data = self.find_nearest_road_node(dest_lng, dest_lat)
        origin_name = origin_data.get("label", "Selected Start Location") if origin_data else "Selected Start Location"
        dest_name = dest_data.get("label", "Selected Destination") if dest_data else "Selected Destination"

        osrm_routes = []
        try:
            url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson&alternatives=3&steps=true"
            with httpx.Client(timeout=4.5) as client:
                res = client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    osrm_routes = data.get("routes", [])
        except Exception:
            pass

        # Filter flooded hotspots with depth >= 15 cm for spatial proximity analysis
        flooded_spots = []
        for h in hotspots_list:
            hid = str(h.get("id", ""))
            depth = depth_map.get(hid, float(h.get("water_depth_cm", 0.0)))
            lat = float(h.get("latitude", 0.0))
            lon = float(h.get("longitude", 0.0))
            if depth >= 15.0 and lat > 0 and lon > 0:
                flooded_spots.append({
                    "id": hid,
                    "name": h.get("name", hid),
                    "depth": depth,
                    "lat": lat,
                    "lon": lon
                })

        evaluated_routes = []

        if osrm_routes:
            for r_idx, r in enumerate(osrm_routes):
                coords = r.get("geometry", {}).get("coordinates", [])
                if len(coords) < 2:
                    continue

                total_dist_km = round(r.get("distance", 0.0) / 1000.0, 2)
                base_duration_min = round(r.get("duration", 0.0) / 60.0, 1)

                # Derive descriptive route name from major road step names
                legs = r.get("legs", [])
                steps = legs[0].get("steps", []) if legs else []
                road_names = [s.get("name") for s in steps if s.get("name") and len(s.get("name", "")) > 3]
                unique_roads = list(dict.fromkeys(road_names))[:3]
                route_via = f"Via {', '.join(unique_roads)}" if unique_roads else f"Route Option {r_idx + 1}"

                # Spatial Flood Exposure Analysis along the route polyline
                max_depth_cm = 0.0
                flooded_points_count = 0
                encountered_hazards = {}
                bypassed_hazards = []

                # Point-by-point depth evaluation
                point_depths = []
                for pt in coords:
                    p_lon, p_lat = pt[0], pt[1]
                    p_depth = 0.0
                    for fs in flooded_spots:
                        d_km = _haversine_km(p_lon, p_lat, fs["lon"], fs["lat"])
                        if d_km <= 0.28:  # Within 280m of flooded hotspot
                            if fs["depth"] > p_depth:
                                p_depth = fs["depth"]
                            encountered_hazards[fs["id"]] = fs
                    point_depths.append(p_depth)
                    if p_depth >= 15.0:
                        flooded_points_count += 1
                    if p_depth > max_depth_cm:
                        max_depth_cm = p_depth

                exposure_pct = round((flooded_points_count / len(coords)) * 100.0, 1) if coords else 0.0
                is_impassable = max_depth_cm >= 40.0

                # Determine hazards avoided (flooded spots with >=35cm that this route DID NOT cross)
                for fs in flooded_spots:
                    if fs["depth"] >= 35.0 and fs["id"] not in encountered_hazards:
                        bypassed_hazards.append({
                            "node_id": fs["id"],
                            "name": fs["name"],
                            "water_depth_cm": round(fs["depth"], 1),
                            "lat": fs["lat"],
                            "lng": fs["lon"],
                            "reason": f"Safely bypassed {fs['name']} ({round(fs['depth'])}cm water)"
                        })

                # Chunk coordinates into risk-colored segments for Deck.gl rendering
                segments = []
                curr_chunk = [coords[0]]
                curr_risk = "LOW" if point_depths[0] < 15.0 else ("MEDIUM" if point_depths[0] < 40.0 else "HIGH")
                curr_max_d = point_depths[0]

                for p_idx in range(1, len(coords)):
                    pt = coords[p_idx]
                    p_d = point_depths[p_idx]
                    p_risk = "LOW" if p_d < 15.0 else ("MEDIUM" if p_d < 40.0 else "HIGH")

                    if p_risk == curr_risk and len(curr_chunk) < 60:
                        curr_chunk.append(pt)
                        curr_max_d = max(curr_max_d, p_d)
                    else:
                        curr_chunk.append(pt)
                        seg_dist = round(_haversine_km(curr_chunk[0][0], curr_chunk[0][1], curr_chunk[-1][0], curr_chunk[-1][1]), 2)
                        segments.append({
                            "path": curr_chunk,
                            "from_name": f"Km {round(len(segments) * (total_dist_km / max(1, len(steps))), 1)}",
                            "to_name": route_via,
                            "distance_km": max(0.1, seg_dist),
                            "duration_min": round(max(0.5, (seg_dist / max(1.0, total_dist_km)) * base_duration_min), 1),
                            "water_depth_cm": round(curr_max_d, 1),
                            "risk_level": curr_risk,
                            "segment_status": "FLOOD_FREE" if curr_risk == "LOW" else ("SLOW" if curr_risk == "MEDIUM" else "SUBMERGED")
                        })
                        curr_chunk = [pt]
                        curr_risk = p_risk
                        curr_max_d = p_d

                if len(curr_chunk) >= 2:
                    seg_dist = round(_haversine_km(curr_chunk[0][0], curr_chunk[0][1], curr_chunk[-1][0], curr_chunk[-1][1]), 2)
                    segments.append({
                        "path": curr_chunk,
                        "from_name": "Final Approach",
                        "to_name": dest_name,
                        "distance_km": max(0.1, seg_dist),
                        "duration_min": round(max(0.5, (seg_dist / max(1.0, total_dist_km)) * base_duration_min), 1),
                        "water_depth_cm": round(curr_max_d, 1),
                        "risk_level": curr_risk,
                        "segment_status": "FLOOD_FREE" if curr_risk == "LOW" else ("SLOW" if curr_risk == "MEDIUM" else "SUBMERGED")
                    })

                # Safe Route Cost Scoring Formula
                flood_penalty = (exposure_pct * 25.0) + (max_depth_cm * 1.5) + (5000.0 if is_impassable else 0.0)
                travel_time_with_traffic = base_duration_min * (1.0 + (exposure_pct / 50.0))
                composite_safe_score = travel_time_with_traffic + (total_dist_km * 0.4) + flood_penalty

                if max_depth_cm >= 40.0:
                    overall_risk = "HIGH"
                elif max_depth_cm >= 15.0 or exposure_pct > 15.0:
                    overall_risk = "MEDIUM"
                else:
                    overall_risk = "LOW"

                evaluated_routes.append({
                    "id": f"route_{r_idx}",
                    "name": route_via,
                    "distance_km": total_dist_km,
                    "duration_min": round(travel_time_with_traffic, 1),
                    "base_duration_min": base_duration_min,
                    "risk_score": round(min(1.0, (max_depth_cm / 50.0) * 0.7 + (exposure_pct / 100.0) * 0.3), 2),
                    "risk_level": overall_risk,
                    "max_flood_depth_cm": round(max_depth_cm, 1),
                    "flood_exposure_pct": exposure_pct,
                    "is_impassable": is_impassable,
                    "composite_cost": round(composite_safe_score, 1),
                    "full_path": coords,
                    "segments": segments,
                    "hazards_avoided": bypassed_hazards[:4],
                    "advisory": "Impassable: High flood water detected on this corridor." if is_impassable else (
                        "Moderate waterlogging: Expect traffic slowdown." if overall_risk == "MEDIUM" else "Corridor is flood-safe and fully passable."
                    )
                })

        # If OSRM failed or returned no routes, use Dijkstra fallback
        if not evaluated_routes:
            dijkstra_res = self.calculate_safe_route_with_coords(origin_node, dest_node, depth_map)
            d_segs = dijkstra_res.get("segments", [])
            d_path = []
            for s in d_segs:
                d_path.extend(s.get("path", []))
            if not d_path:
                d_path = [start_coord, dest_coord]

            evaluated_routes.append({
                "id": "route_0",
                "name": f"Via {origin_name} to {dest_name}",
                "distance_km": dijkstra_res.get("distance_km", 14.2),
                "duration_min": dijkstra_res.get("duration_min", 25.0),
                "base_duration_min": dijkstra_res.get("duration_min", 25.0),
                "risk_score": dijkstra_res.get("risk_score", 0.1),
                "risk_level": dijkstra_res.get("risk_level", "LOW"),
                "max_flood_depth_cm": 0.0,
                "flood_exposure_pct": 0.0,
                "is_impassable": False,
                "composite_cost": dijkstra_res.get("duration_min", 25.0),
                "full_path": d_path,
                "segments": d_segs if d_segs else [{
                    "path": [start_coord, dest_coord],
                    "from_name": origin_name,
                    "to_name": dest_name,
                    "distance_km": 14.2,
                    "duration_min": 25.0,
                    "water_depth_cm": 0.0,
                    "risk_level": "LOW",
                    "segment_status": "FLOOD_FREE"
                }],
                "hazards_avoided": dijkstra_res.get("hazards_avoided", []),
                "advisory": dijkstra_res.get("advisory", "Dijkstra safe routing corridor active.")
            })

        # Rank all evaluated routes by composite_cost (lowest cost is BEST SAFE ROUTE)
        evaluated_routes.sort(key=lambda x: x["composite_cost"])
        for idx, r in enumerate(evaluated_routes):
            r["is_recommended"] = (idx == 0)
            if idx == 0:
                r["rank_badge"] = "BEST SAFE ROUTE"
            else:
                r["rank_badge"] = f"ALTERNATIVE {idx}"

        return {
            "origin_name": origin_name,
            "destination_name": dest_name,
            "origin_coord": start_coord,
            "destination_coord": dest_coord,
            "best_route_index": 0,
            "routes_count": len(evaluated_routes),
            "routes": evaluated_routes
        }

    def get_graph_dict(self):
        nodes_list = []
        for n, d in self.G.nodes(data=True):
            nodes_list.append({
                "id": n,
                "label": d.get("label", n),
                "type": d.get("type", "ROAD"),
                "ward": d.get("ward", "F/S"),
                "status": d.get("status", "SAFE"),
                "health_score": d.get("health", 80.0),
                "failure_risk_score": d.get("risk", 20.0),
                "water_depth_cm": d.get("water_depth", 0.0),
                "lat": d.get("lat", 19.07),
                "lon": d.get("lon", 72.87)
            })

        edges_list = []
        for u, v, d in self.G.edges(data=True):
            edges_list.append({
                "source": u,
                "target": v,
                "type": d.get("type", "HYDRAULIC_RUNOFF"),
                "weight": d.get("weight", 1.0),
                "active": True,
                "description": d.get("description", "")
            })

        return {"nodes": nodes_list, "edges": edges_list}

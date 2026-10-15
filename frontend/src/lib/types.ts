export interface ComponentTelemetry {
  component_id: string;
  component_type: string;
  name: string;
  ward: string;
  health_score: number;
  failure_risk_score: number;
  status: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  water_depth_cm: number;
  pothole_probability: number;
  traffic_speed_kmh: number;
  traffic_congestion_pct: number;
  drain_discharge_capacity_cumecs: number;
  drain_siltation_pct: number;
  tidal_backflow_blocked: boolean;
  recommended_action: string;
  cascading_impact_summary: string;
  metrics: Record<string, any>;
}

export interface CitySummary {
  overall_infrastructure_health: number;
  average_failure_risk?: number;
  active_submerged_hotspots?: number;
  roads_critical_count?: number;
  drains_overloaded_count?: number;
  pumping_stations_active?: number;
  citywide_avg_water_depth_cm?: number;
  high_tide_warning: boolean;
  disruption_severity: string;
  average_traffic_speed_kmh?: number;
  max_water_depth_cm?: number;
}

export interface TopPriorityHotspot {
  rank: number;
  component_id: string;
  name?: string;
  component_name?: string;
  ward: string;
  composite_priority_score?: number;
  priority_score?: number;
  urgency_level?: string;
  urgency?: string;
  estimated_impacted_citizens?: number;
  recommended_intervention?: string;
  recommended_action?: string;
  required_pump_capacity_cumecs?: number;
  estimated_cost_inr_lakhs?: number;
  estimated_cost_inr?: number;
  traffic_diverted_route?: string;
}

export type PriorityIntervention = TopPriorityHotspot;

export interface TimelineForecastStep {
  time_offset: string;
  time_minutes: number;
  predicted_rainfall_mm_hr: number;
  city_max_depth_cm: number;
  critical_hotspots_count: number;
  components: ComponentTelemetry[];
}

export interface SimulationResponse {
  simulation_id?: string;
  timestamp?: string;
  parameters?: any;
  city_summary: CitySummary;
  components: ComponentTelemetry[];
  top_priorities: TopPriorityHotspot[];
  critical_hotspots_count?: number;
  roads_at_risk_count?: number;
  drains_overflowing_count?: number;
  traffic_disruption_index?: number;
  timeline_forecast?: TimelineForecastStep[];
  cascade_summary?: {
    seed_failure_nodes: string[];
    cascade_chains: string[][];
    total_impacted_nodes: number;
  };
  simulation_metadata?: Record<string, any>;
}

export interface SimulationRequest {
  rainfall_mm_hr: number;
  tide_level_m: number;
  siltation_pct: number;
  active_scenario_name?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  ward: string;
  status: string;
  health_score: number;
  failure_risk_score: number;
  water_depth_cm: number;
  lat: number;
  lon: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  active: boolean;
  description: string;
}

export interface CascadingGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  active_cascade_chains: string[][];
  total_impacted_nodes: number;
}

export interface CitizenReportRequest {
  reporter_name?: string;
  location_name?: string;
  landmark?: string;
  ward?: string;
  category?: string;
  severity?: string;
  pothole_severity?: string;
  water_depth_reported?: string;
  estimated_water_depth_cm?: number;
  description?: string;
  latitude?: number;
  longitude?: number;
}

export interface CitizenReportResponse {
  report_id?: string;
  ticket_id?: string;
  timestamp?: string;
  status: string;
  verification_status?: string;
  matched_component_id?: string;
  assigned_priority?: string;
  priority_rank?: number;
  estimated_resolution_hrs?: number;
  estimated_eta_hours?: number;
  ticket_message?: string;
  message?: string;
}

export interface AvoidedHazard {
  node_id: string;
  name: string;
  water_depth_cm: number;
  reason: string;
}

export interface RouteSegment {
  from_node: string;
  to_node: string;
  water_depth_cm: number;
  segment_status: "FLOOD_FREE" | "SLOW" | "SUBMERGED";
}

export interface SafeRouteResponse {
  origin: string;
  destination: string;
  is_flood_safe: boolean;
  recommended_path: string[];
  path_waypoints: string[];
  estimated_transit_time_mins: number;
  submerged_hazards_avoided: AvoidedHazard[];
  route_segments: RouteSegment[];
  fallback_advisory?: string;
}

export interface DEMGridResponse {
  rows: number;
  cols: number;
  elevation_matrix_m: number[][];
  flow_accumulation_matrix: number[][];
  inundation_depth_matrix_cm: number[][];
  max_grid_depth_cm: number;
  grid_resolution_km: number;
}

export interface CoordinateRouteSegment {
  path: [number, number][];
  from_node: string;
  to_node: string;
  from_name: string;
  to_name: string;
  distance_km: number;
  duration_min: number;
  water_depth_cm: number;
  risk: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  segment_status: "FLOOD_FREE" | "SLOW" | "SUBMERGED";
}

export interface CoordinateRouteHazard {
  node_id: string;
  name: string;
  water_depth_cm: number;
  lat: number;
  lng: number;
  reason?: string;
}

export interface EvaluatedRouteOption {
  id: string;
  name: string;
  distance_km: number;
  duration_min: number;
  base_duration_min: number;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  max_flood_depth_cm: number;
  flood_exposure_pct: number;
  is_impassable: boolean;
  is_recommended: boolean;
  rank_badge: string;
  composite_cost: number;
  full_path: [number, number][];
  segments: CoordinateRouteSegment[];
  hazards_avoided: CoordinateRouteHazard[];
  advisory: string;
}

export interface MultiRouteResponse {
  origin_name: string;
  destination_name: string;
  origin_coord: [number, number];
  destination_coord: [number, number];
  best_route_index: number;
  routes_count: number;
  routes: EvaluatedRouteOption[];
  // Backwards compatibility convenience fields:
  distance_km?: number;
  duration_min?: number;
  risk_score?: number;
  risk_level?: "LOW" | "MEDIUM" | "HIGH";
  segments?: CoordinateRouteSegment[];
  hazards_avoided?: CoordinateRouteHazard[];
  advisory?: string;
  is_flood_safe?: boolean;
}

export type CoordinateRouteResponse = MultiRouteResponse;

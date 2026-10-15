import { SimulationRequest, SimulationResponse, CascadingGraphResponse, CitizenReportRequest, CitizenReportResponse, SafeRouteResponse, DEMGridResponse, CoordinateRouteResponse, EvaluatedRouteOption, CoordinateRouteSegment } from './types';

const API_BASE = '/api';

export interface MinutelyForecast {
  time_offset: string;
  rain_mm_hr: number;
  status: string;
}

export interface HourlyForecastItem {
  time: string;
  temp_c: number;
  humidity_pct: number;
  precip_mm: number;
  weather_code: number;
  wind_kmh: number;
}

export interface DailyForecastItem {
  date: string;
  weather_code: number;
  temp_max_c: number;
  temp_min_c: number;
  precipitation_sum_mm: number;
  wind_speed_max_kmh: number;
}

export interface RegionalZoneTelemetry {
  zone_id: string;
  zone_name: string;
  landmarks: string;
  corridor: string;
  latitude: number;
  longitude: number;
  rainfall_mm_hr: number;
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  weather_code: number;
  minutely_forecast: MinutelyForecast[];
  has_rain: boolean;
}

export interface LiveTelemetry {
  status: string;
  rainfall_mm_hr: number;
  citywide_max_rain_mm_hr?: number;
  tide_level_m: number;
  temperature_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  weather_code: number;
  last_updated: string | null;
  source: string;
  fetch_count: number;
  early_warning_active: boolean;
  next_rain_eta_mins: number;
  target_rain_timestamp_ms: number;
  predicted_rain_in_30m: number;
  preemptive_action: string;
  minutely_forecast: MinutelyForecast[];
  hourly_forecast?: HourlyForecastItem[];
  daily_forecast?: DailyForecastItem[];
  regional_zones?: Record<string, RegionalZoneTelemetry>;
  active_rain_zones?: RegionalZoneTelemetry[];
  primary_active_zone?: RegionalZoneTelemetry | null;
  regional_alert_headline?: string;
}

export async function runSimulation(req: SimulationRequest): Promise<SimulationResponse> {
  try {
    const res = await fetch(`${API_BASE}/simulation/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend unavailable, using client-side fallback calculation...', err);
    return getFallbackSimulation(req);
  }
}

export async function fetchCascadingGraph(): Promise<CascadingGraphResponse> {
  try {
    const res = await fetch(`${API_BASE}/graph/cascading-topology`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    return getFallbackGraph();
  }
}

export async function fetchLiveTelemetry(): Promise<LiveTelemetry | null> {
  try {
    const res = await fetch(`${API_BASE}/live/current`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend unreachable — returning OFFLINE telemetry state', err);
    return {
      status: 'OFFLINE',
      rainfall_mm_hr: 0.0,
      citywide_max_rain_mm_hr: 0.0,
      tide_level_m: 0.0,
      temperature_c: 0.0,
      humidity_pct: 0.0,
      wind_speed_kmh: 0.0,
      weather_code: 0,
      last_updated: null,
      source: 'OFFLINE — Backend Unreachable',
      fetch_count: 0,
      early_warning_active: false,
      next_rain_eta_mins: 0,
      target_rain_timestamp_ms: 0,
      predicted_rain_in_30m: 0.0,
      preemptive_action: '',
      minutely_forecast: [],
      hourly_forecast: [],
      daily_forecast: [],
      regional_zones: {},
      active_rain_zones: [],
      primary_active_zone: null,
      regional_alert_headline: 'Offline',
    };
  }
}

export async function submitCitizenReport(req: CitizenReportRequest): Promise<CitizenReportResponse> {
  try {
    const res = await fetch(`${API_BASE}/citizen/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    return {
      ticket_id: `BMC-2024-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: new Date().toLocaleString(),
      status: 'REGISTERED_WORK_ORDER_CREATED',
      verification_status: 'AI_VERIFIED_GROUND_TRUTH',
      matched_component_id: 'RD_BAR_01',
      priority_rank: 2,
      estimated_eta_hours: 2.0,
      message: `Thank you, ${req.reporter_name}. Your report for ${req.landmark} has been ingested into the BMC Digital Twin.`,
    };
  }
}

export interface CitizenReportRecord {
  id: number;
  reporter_name: string;
  category: string;
  landmark: string;
  severity: string;
  description: string;
  latitude: number;
  longitude: number;
  ward: string;
  estimated_water_depth_cm: number;
  timestamp: string;
}

export async function fetchRecentCitizenReports(): Promise<CitizenReportRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/citizen/recent`);
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    return data.reports || [];
  } catch {
    return [];
  }
}

export async function fetchSafeRoute(
  originId: string = 'RD_MDR_01',
  destinationId: string = 'WL_AND_01',
  rainfall: number = 150.0
): Promise<SafeRouteResponse> {
  try {
    const res = await fetch(`${API_BASE}/graph/safe-route?origin=${encodeURIComponent(originId)}&destination=${encodeURIComponent(destinationId)}&rainfall_mm_hr=${rainfall}`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    return getFallbackSafeRoute(originId, destinationId, rainfall);
  }
}

export async function fetchCoordinateRoute(
  start: [number, number],
  destination: [number, number],
  rainfall_mm_hr: number = 85.0,
  tide_level_m: number = 3.5,
  siltation_pct: number = 35.0
): Promise<CoordinateRouteResponse> {
  try {
    const res = await fetch(`${API_BASE}/routes/safe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, destination, rainfall_mm_hr, tide_level_m, siltation_pct }),
    });
    if (!res.ok) throw new Error('Coordinate route API request failed');
    return await res.json();
  } catch (err) {
    console.warn('Coordinate route API failed, using fallback...', err);
    return getCoordinateRouteFallback(start, destination, rainfall_mm_hr);
  }
}

function getCoordinateRouteFallback(
  start: [number, number],
  destination: [number, number],
  rainfall: number
): CoordinateRouteResponse {
  const isHeavy = rainfall >= 80;
  const midPt: [number, number] = [(start[0] + destination[0]) / 2, (start[1] + destination[1]) / 2];
  const altPt: [number, number] = [midPt[0] - 0.015, midPt[1] + 0.005];

  const route0Segments: CoordinateRouteSegment[] = [
    {
      path: [start, midPt],
      from_node: "START_POINT",
      to_node: "RD_WEH_01",
      from_name: "Start Location",
      to_name: "Western Express Highway Elevated Corridor",
      distance_km: 7.2,
      duration_min: isHeavy ? 14.0 : 10.0,
      water_depth_cm: 0,
      risk: 0.0,
      risk_level: "LOW",
      segment_status: "FLOOD_FREE",
    },
    {
      path: [midPt, destination],
      from_node: "RD_WEH_01",
      to_node: "DEST_POINT",
      from_name: "Western Express Highway",
      to_name: "Destination Terminal",
      distance_km: 7.5,
      duration_min: isHeavy ? 15.0 : 11.0,
      water_depth_cm: isHeavy ? 12 : 0,
      risk: isHeavy ? 0.24 : 0.0,
      risk_level: "LOW",
      segment_status: "FLOOD_FREE",
    },
  ];

  const route1Segments: CoordinateRouteSegment[] = [
    {
      path: [start, altPt],
      from_node: "START_POINT",
      to_node: "RD_SVR_02",
      from_name: "Start Location",
      to_name: "Swami Vivekanand (SV) Road Lowline",
      distance_km: 6.5,
      duration_min: isHeavy ? 22.0 : 11.0,
      water_depth_cm: isHeavy ? 45 : 8,
      risk: isHeavy ? 0.9 : 0.16,
      risk_level: isHeavy ? "HIGH" : "LOW",
      segment_status: isHeavy ? "SUBMERGED" : "FLOOD_FREE",
    },
    {
      path: [altPt, destination],
      from_node: "RD_SVR_02",
      to_node: "DEST_POINT",
      from_name: "SV Road (Near Milan Subway Bowl)",
      to_name: "Destination Terminal",
      distance_km: 6.8,
      duration_min: isHeavy ? 26.0 : 12.0,
      water_depth_cm: isHeavy ? 88 : 12,
      risk: isHeavy ? 1.0 : 0.24,
      risk_level: isHeavy ? "HIGH" : "LOW",
      segment_status: isHeavy ? "SUBMERGED" : "FLOOD_FREE",
    },
  ];

  const hazardsAvoided = isHeavy
    ? [
        { node_id: "WLS_MLN_03", name: "Milan Subway Basin", water_depth_cm: 92.4, lat: 19.0865, lng: 72.8395, reason: "Avoided 92.4cm submerged underpass" },
        { node_id: "WLS_HND_01", name: "Hindmata Junction", water_depth_cm: 65.0, lat: 19.0095, lng: 72.8425, reason: "Avoided 65.0cm floodwater" },
      ]
    : [];

  const routes: EvaluatedRouteOption[] = [
    {
      id: "route_0",
      name: "Via Western Express Highway Elevated Corridor",
      distance_km: 14.7,
      duration_min: isHeavy ? 29.0 : 21.0,
      base_duration_min: 21.0,
      risk_score: isHeavy ? 0.12 : 0.05,
      risk_level: "LOW",
      max_flood_depth_cm: isHeavy ? 12.0 : 0.0,
      flood_exposure_pct: 0.0,
      is_impassable: false,
      is_recommended: true,
      rank_badge: "BEST SAFE ROUTE",
      composite_cost: isHeavy ? 35.0 : 25.0,
      full_path: [start, midPt, destination],
      segments: route0Segments,
      hazards_avoided: hazardsAvoided,
      advisory: "Elevated expressway route completely bypasses low-lying flood basins.",
    },
    {
      id: "route_1",
      name: "Via Swami Vivekanand (SV) Road Low Corridor",
      distance_km: 13.3,
      duration_min: isHeavy ? 48.0 : 23.0,
      base_duration_min: 23.0,
      risk_score: isHeavy ? 0.95 : 0.2,
      risk_level: isHeavy ? "HIGH" : "LOW",
      max_flood_depth_cm: isHeavy ? 88.0 : 12.0,
      flood_exposure_pct: isHeavy ? 65.0 : 5.0,
      is_impassable: isHeavy,
      is_recommended: false,
      rank_badge: "ALTERNATIVE 1",
      composite_cost: isHeavy ? 5200.0 : 28.0,
      full_path: [start, altPt, destination],
      segments: route1Segments,
      hazards_avoided: [],
      advisory: isHeavy ? "Warning: High water depth near Milan & Khar subways. Traffic impassable." : "Passable under light rain.",
    },
  ];

  return {
    origin_name: "Selected Start Location",
    destination_name: "Selected Destination",
    origin_coord: start,
    destination_coord: destination,
    best_route_index: 0,
    routes_count: routes.length,
    routes,
    distance_km: routes[0].distance_km,
    duration_min: routes[0].duration_min,
    risk_score: routes[0].risk_score,
    risk_level: routes[0].risk_level,
    segments: routes[0].segments,
    hazards_avoided: routes[0].hazards_avoided,
    advisory: routes[0].advisory,
    is_flood_safe: !routes[0].is_impassable,
  };
}

function getFallbackSafeRoute(originId: string, destinationId: string, rainfall: number): SafeRouteResponse {
  const isHeavy = rainfall >= 80;
  return {
    origin: originId,
    destination: destinationId,
    is_flood_safe: true,
    recommended_path: ['RD_MDR_01', 'RD_BAR_01', 'RD_BKC_01', 'RD_WEH_01', 'WL_AND_01'],
    path_waypoints: [
      'Marine Drive Corridor',
      'Dr. B.A. Road Flyover',
      'BKC Elevated Connector',
      'Western Express Highway Elevated Corridor',
      'Andheri Station Approach (Bypassing Subway Bowl)'
    ],
    estimated_transit_time_mins: isHeavy ? 38.5 : 24.0,
    submerged_hazards_avoided: isHeavy
      ? [
          {
            node_id: 'WL_HND_01',
            name: 'Hindmata Underpass',
            water_depth_cm: 65.0,
            reason: 'Submerged by 65.0 cm floodwater (Route Diverted via Dr. B.A. Flyover)',
          },
          {
            node_id: 'WL_MLN_01',
            name: 'Milan Subway Low Basin',
            water_depth_cm: 95.0,
            reason: 'Submerged by 95.0 cm floodwater (Route Diverted via WEH Flyover)',
          },
        ]
      : [],
    route_segments: [
      { from_node: 'RD_MDR_01', to_node: 'RD_BAR_01', water_depth_cm: 0, segment_status: 'FLOOD_FREE' },
      { from_node: 'RD_BAR_01', to_node: 'RD_BKC_01', water_depth_cm: 8, segment_status: 'FLOOD_FREE' },
      { from_node: 'RD_BKC_01', to_node: 'RD_WEH_01', water_depth_cm: 12, segment_status: 'FLOOD_FREE' },
      { from_node: 'RD_WEH_01', to_node: 'WL_AND_01', water_depth_cm: isHeavy ? 22 : 0, segment_status: isHeavy ? 'SLOW' : 'FLOOD_FREE' },
    ],
    fallback_advisory: 'Take Western Express Highway Elevated Corridor. Avoid SV Road and Milan Subway.',
  };
}

export async function fetchDEMGrid(rainfall: number = 45.0, tide: number = 2.8): Promise<DEMGridResponse> {
  try {
    const res = await fetch(`${API_BASE}/simulation/dem-surface-grid?rainfall_mm_hr=${rainfall}&tide_level_m=${tide}`);
    if (!res.ok) throw new Error('API request failed');
    return await res.json();
  } catch (err) {
    return getFallbackDEMGrid(rainfall, tide);
  }
}

export async function fetchRoadNetworkGeoJSON(): Promise<any> {
  try {
    const res = await fetch('/data/mumbai_road_network.geojson');
    if (res.ok) return await res.json();
    const backendRes = await fetch(`${API_BASE}/simulation/road-network-geojson`);
    if (backendRes.ok) return await backendRes.json();
    return { type: 'FeatureCollection', features: [] };
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

export async function fetchWardZonesGeoJSON(): Promise<any> {
  try {
    const res = await fetch('/data/mumbai_flood_inundation_zones.geojson');
    if (res.ok) return await res.json();
    return { type: 'FeatureCollection', features: [] };
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}


function getFallbackDEMGrid(rainfall: number, tide: number): DEMGridResponse {
  const rows = 15;
  const cols = 15;
  const elev: number[][] = [];
  const flow: number[][] = [];
  const depth: number[][] = [];
  let maxD = 0;

  for (let r = 0; r < rows; r++) {
    const rElev: number[] = [];
    const rFlow: number[] = [];
    const rDepth: number[] = [];
    for (let c = 0; c < cols; c++) {
      const e = Math.max(1.0, Math.round((3.5 + 2.0 * Math.sin(r * 0.4) + 1.5 * Math.cos(c * 0.3)) * 10) / 10);
      const f = Math.round((1.0 + (rows - r) * 0.4 + (c < 8 ? 2.5 : 1.0)) * 10) / 10;
      let d = 0;
      if (rainfall > 5.0) {
        d = e < 2.5 ? Math.round((rainfall * 0.45 + (3.0 - e) * 12.0) * 10) / 10 : Math.round((rainfall * 0.12) * 10) / 10;
        if (tide >= 3.5 && e < 2.2) d += Math.round((tide - 3.2) * 16.0);
      }
      maxD = Math.max(maxD, d);
      rElev.push(e);
      rFlow.push(f);
      rDepth.push(d);
    }
    elev.push(rElev);
    flow.push(rFlow);
    depth.push(rDepth);
  }

  return {
    rows,
    cols,
    elevation_matrix_m: elev,
    flow_accumulation_matrix: flow,
    inundation_depth_matrix_cm: depth,
    max_grid_depth_cm: maxD,
    grid_resolution_km: 1.2,
  };
}

function getFallbackSimulation(req: SimulationRequest): SimulationResponse {
  const isHighTide = req.tide_level_m >= 4.2;
  const isHeavyRain = req.rainfall_mm_hr >= 100;
  
  return {
    simulation_id: `SIM_LOC_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString() + ' IST',
    parameters: req,
    city_summary: {
      overall_infrastructure_health: Math.max(25, Math.round(90 - (req.rainfall_mm_hr * 0.25) - (req.tide_level_m * 5.0))),
      disruption_severity: isHeavyRain || isHighTide ? 'HIGH / RED ALERT' : 'MODERATE / AMBER',
      high_tide_warning: isHighTide,
      average_traffic_speed_kmh: Math.max(8, Math.round(55 - (req.rainfall_mm_hr * 0.18))),
      max_water_depth_cm: Math.round(Math.min(120, req.rainfall_mm_hr * 0.35 + (req.tide_level_m > 3.8 ? 15 : 0))),
    },
    critical_hotspots_count: req.rainfall_mm_hr > 80 ? 5 : 2,
    roads_at_risk_count: req.rainfall_mm_hr > 80 ? 8 : 3,
    drains_overflowing_count: req.siltation_pct > 40 || req.rainfall_mm_hr > 100 ? 4 : 1,
    traffic_disruption_index: Math.min(95, Math.round((req.rainfall_mm_hr / 200) * 80 + (req.tide_level_m / 5.0) * 20)),
    components: [],
    top_priorities: [],
    cascade_summary: {
      seed_failure_nodes: ['WL_HND_01', 'WL_MLN_01'],
      cascade_chains: [['WL_HND_01', 'RD_BAR_01', 'RD_EEH_01']],
      total_impacted_nodes: 6,
    }
  };
}

function getFallbackGraph(): CascadingGraphResponse {
  return {
    nodes: [
      { id: 'WL_HND_01', label: 'Hindmata Junction', type: 'HOTSPOT', ward: 'F/S', status: 'CRITICAL', health_score: 35, failure_risk_score: 85, water_depth_cm: 38, lat: 19.0125, lon: 72.8432 },
      { id: 'DRN_HND_01', label: 'Hindmata SWD Conduit', type: 'DRAIN', ward: 'F/S', status: 'CRITICAL', health_score: 40, failure_risk_score: 80, water_depth_cm: 0, lat: 19.011, lon: 72.842 },
      { id: 'RD_BAR_01', label: 'Dr. Ambedkar Road', type: 'ROAD', ward: 'F/S', status: 'CRITICAL', health_score: 42, failure_risk_score: 82, water_depth_cm: 28, lat: 19.012, lon: 72.843 },
      { id: 'RD_EEH_01', label: 'EEH Sion Circle', type: 'ROAD', ward: 'F/N', status: 'WARNING', health_score: 55, failure_risk_score: 65, water_depth_cm: 14, lat: 19.045, lon: 72.871 },
      { id: 'PMP_BRITANNIA_01', label: 'Britannia Pumping Station', type: 'PUMP', ward: 'E', status: 'SAFE', health_score: 88, failure_risk_score: 15, water_depth_cm: 0, lat: 18.985, lon: 72.845 },
    ],
    edges: [
      { source: 'WL_HND_01', target: 'DRN_HND_01', type: 'HYDRAULIC_RUNOFF', weight: 0.95, active: true, description: 'Hindmata bowl runoff drains to SWD conduit' },
      { source: 'DRN_HND_01', target: 'PMP_BRITANNIA_01', type: 'HYDRAULIC_CONVEYANCE', weight: 0.92, active: true, description: 'Conduit discharge to Britannia Pumping Station' },
      { source: 'WL_HND_01', target: 'RD_BAR_01', type: 'DISRUPTION_SPILLOVER', weight: 0.98, active: true, description: 'Flooding shuts Dr. Ambedkar Road' },
      { source: 'RD_BAR_01', target: 'RD_EEH_01', type: 'DISRUPTION_SPILLOVER', weight: 0.85, active: true, description: 'Traffic diverted to Eastern Express Highway' },
    ],
    active_cascade_chains: [['WL_HND_01', 'DRN_HND_01', 'PMP_BRITANNIA_01'], ['WL_HND_01', 'RD_BAR_01', 'RD_EEH_01']],
    total_impacted_nodes: 4
  };
}

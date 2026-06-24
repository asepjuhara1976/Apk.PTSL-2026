import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  auth, 
  googleAuthProvider 
} from './lib/firebase.ts';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  parseKML, 
  exportToKML, 
  ParsedKMLAsset 
} from './lib/kmlParser.ts';
import { 
  Layers, 
  Upload, 
  Plus, 
  MapPin, 
  Sparkles, 
  Check, 
  Trash2, 
  Settings, 
  LogOut, 
  Map as MapIcon, 
  Compass, 
  Locate, 
  Search, 
  Download, 
  Edit3, 
  Filter,
  RefreshCw,
  Info,
  X,
  PlusCircle,
  Eye,
  EyeOff,
  User as UserIcon,
  MapPinned,
  FileSpreadsheet,
  Users
} from 'lucide-react';

import { ApplicantForm } from './components/ApplicantForm.tsx';
import { ApplicantSummary } from './components/ApplicantSummary.tsx';
import { useApplicant } from './context/ApplicantContext.tsx';

// Base styles for custom geometric drawings
const COLOR_PRESETS = [
  '#4285F4', // Google Blue
  '#EA4335', // Google Red
  '#FBBC05', // Google Yellow
  '#34A853', // Google Green
  '#8E24AA', // Purple
  '#F4511E', // Orange
  '#00ACC1', // Cyan
  '#1A237E'  // Navy
];

interface Asset {
  id: number;
  userId: number | null;
  name: string;
  description: string;
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any;
  properties: {
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    fillOpacity?: number;
  };
  distance?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// Custom Marker CSS-based creator for stylish pins
const createCustomMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color};" class="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all hover:scale-110">
             <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
           </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

export default function App() {
  return (
    <GeoDataManagerDashboard />
  );
}

function GeoDataManagerDashboard() {
  // Authentication State
  const [user, setUser] = useState<any>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Custom Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Geospatial Assets loaded from PostGIS
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  
  // Layer visibility toggles
  const [showPoints, setShowPoints] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showPolygons, setShowPolygons] = useState(true);

  // Drawing state
  const [drawMode, setDrawMode] = useState<'None' | 'Point' | 'LineString' | 'Polygon'>('None');
  const [tempCoords, setTempCoords] = useState<{ lat: number; lng: number }[]>([]);
  
  // Selected / active asset state (for the Attribute Editor)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editorName, setEditorName] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorColor, setEditorColor] = useState('#4285F4');
  const [editorFillColor, setEditorFillColor] = useState('#4285F4');
  const [editorStrokeWidth, setEditorStrokeWidth] = useState(3);
  const [editorFillOpacity, setEditorFillOpacity] = useState(0.3);

  // Spatial query states
  const [spatialFilterMode, setSpatialFilterMode] = useState<'None' | 'BBox' | 'Radius'>('None');
  const [searchRadius, setSearchRadius] = useState<number>(20000); // meters
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [syncViewportActive, setSyncViewportActive] = useState(false);
  
  // KML import wizard states
  const [importedKmlList, setImportedKmlList] = useState<ParsedKMLAsset[]>([]);
  const [isKmlModalOpen, setIsKmlModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Map settings
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [viewportBounds, setViewportBounds] = useState<string | null>(null);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'map' | 'pemohon' | 'data_summary'>('map');
  const [showSidebarMobile, setShowSidebarMobile] = useState(false);

  // GPS Geolocation Handler
  const handleGpsLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (leafletMapRef.current) {
            leafletMapRef.current.setView([latitude, longitude], 20);
            L.popup()
              .setLatLng([latitude, longitude])
              .setContent("<div class='p-1.5 text-center font-sans'><b class='text-indigo-600 font-bold text-xs'>Sinyal GPS Terdeteksi!</b><p class='text-[10px] text-slate-500 mt-1'>Ini adalah lokasi koordinat GPS akurat perangkat Anda saat ini.</p></div>")
              .openOn(leafletMapRef.current);
          } else {
            alert(`GPS Terdeteksi: Lat: ${latitude}, Lng: ${longitude}. Silakan masuk ke tab Peta untuk melihat.`);
          }
        },
        (error) => {
          console.error("Error getting GPS location:", error);
          alert("Gagal mendapatkan lokasi GPS: " + error.message);
        }
      );
    } else {
      alert("Browser tidak mendukung GPS Geolocation");
    }
  };

  // Leaflet map container refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const drawnLayersGroupRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Auto-center map on selected asset
  const centerMapOnAsset = (asset: Asset) => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (asset.type === 'Point') {
      const latlng = asset.coordinates;
      if (latlng && typeof latlng.lat === 'number' && typeof latlng.lng === 'number') {
        const currentZoom = map.getZoom();
        // Preserve zoom if already zoomed in, else maximize zoom to 20
        const targetZoom = currentZoom && currentZoom > 13 ? currentZoom : 20;
        map.setView([latlng.lat, latlng.lng], targetZoom);
      }
    } else {
      const coords = asset.coordinates;
      if (Array.isArray(coords) && coords.length > 0) {
        const latlngs = coords.map(c => [c.lat, c.lng] as [number, number]);
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-6.2088, 106.8456], // default Jakarta
      zoom: 11,
      maxZoom: 22,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    leafletMapRef.current = map;

    const drawnGroup = L.featureGroup().addTo(map);
    drawnLayersGroupRef.current = drawnGroup;

    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 22,
      maxNativeZoom: 19
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Set initial bounds
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    setViewportBounds(`${sw.lng},${sw.lat},${ne.lng},${ne.lat}`);

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, []);

  // Update Base Layer Tile Source on mapType change
  useEffect(() => {
    if (!leafletMapRef.current) return;

    let url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    let attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    if (mapType === 'satellite') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
    } else if (mapType === 'terrain') {
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      attr = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community';
    }

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const newTileLayer = L.tileLayer(url, {
      attribution: attr,
      maxZoom: 22,
      maxNativeZoom: mapType === 'satellite' ? 19 : 18
    }).addTo(leafletMapRef.current);
    
    tileLayerRef.current = newTileLayer;
  }, [mapType]);

  // Sync Leaflet moveend bounds to viewport state and fetch if in BBox query
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const onMoveEnd = () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bboxStr = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
      setViewportBounds(bboxStr);

      if (syncViewportActive && spatialFilterMode === 'BBox') {
        fetchAssets({ bbox: bboxStr });
      }
    };

    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [syncViewportActive, spatialFilterMode, userToken]);

  // Handle Map clicks for geometry placements or probe centers
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      // 1. Handle Radius spatial filter selection
      if (spatialFilterMode === 'Radius') {
        setRadiusCenter({ lat: clickedLat, lng: clickedLng });
        fetchAssets({
          lat: clickedLat,
          lng: clickedLng,
          radius: searchRadius
        });
        return;
      }

      // 2. Handle Drawing point, line, or polygon
      if (drawMode === 'Point') {
        const newPoint: Asset = {
          id: -1,
          userId: null,
          name: 'New Point Asset',
          description: '',
          type: 'Point',
          coordinates: { lat: clickedLat, lng: clickedLng },
          properties: { color: editorColor }
        };
        setTempCoords([]);
        openEditorForAsset(newPoint);
        setDrawMode('None');
      } else if (drawMode === 'LineString' || drawMode === 'Polygon') {
        setTempCoords((prev) => [...prev, { lat: clickedLat, lng: clickedLng }]);
      }
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [spatialFilterMode, drawMode, searchRadius, editorColor, userToken]);

  // Unified Rendering hook for all features on the Leaflet map
  useEffect(() => {
    const map = leafletMapRef.current;
    const group = drawnLayersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Render assets
    const visibleAssets = assets.filter((asset) => {
      if (asset.type === 'Point' && !showPoints) return false;
      if (asset.type === 'LineString' && !showLines) return false;
      if (asset.type === 'Polygon' && !showPolygons) return false;
      return true;
    });

    visibleAssets.forEach((asset) => {
      if (asset.type === 'Point') {
        const latlng = asset.coordinates;
        if (latlng && typeof latlng.lat === 'number' && typeof latlng.lng === 'number') {
          const marker = L.marker([latlng.lat, latlng.lng], {
            icon: createCustomMarkerIcon(asset.properties?.color || '#4285F4'),
            title: asset.name
          });
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openEditorForAsset(asset);
          });
          marker.addTo(group);
        }
      } else if (asset.type === 'LineString') {
        const coords = asset.coordinates;
        if (Array.isArray(coords) && coords.length > 0) {
          const latlngs = coords.map(c => [c.lat, c.lng] as [number, number]);
          const polyline = L.polyline(latlngs, {
            color: asset.properties?.color || '#4285F4',
            weight: asset.properties?.strokeWidth || 3,
            opacity: 1.0
          });
          polyline.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openEditorForAsset(asset);
          });
          polyline.addTo(group);
        }
      } else if (asset.type === 'Polygon') {
        const coords = asset.coordinates;
        if (Array.isArray(coords) && coords.length > 0) {
          const latlngs = coords.map(c => [c.lat, c.lng] as [number, number]);
          const polygon = L.polygon(latlngs, {
            color: asset.properties?.color || '#4285F4',
            weight: asset.properties?.strokeWidth || 3,
            opacity: 0.8,
            fillColor: asset.properties?.fillColor || '#4285F4',
            fillOpacity: asset.properties?.fillOpacity || 0.3
          });
          polygon.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            openEditorForAsset(asset);
          });
          polygon.addTo(group);
        }
      }
    });

    // 2. Render active spatial radius query circle
    if (radiusCenter && spatialFilterMode === 'Radius') {
      const circle = L.circle([radiusCenter.lat, radiusCenter.lng], {
        radius: searchRadius,
        color: '#6366F1',
        weight: 1.5,
        opacity: 0.8,
        fillColor: '#6366F1',
        fillOpacity: 0.1,
        interactive: false
      });
      circle.addTo(group);

      const centerMarker = L.marker([radiusCenter.lat, radiusCenter.lng], {
        icon: L.divIcon({
          className: 'radius-center-icon',
          html: `<div class="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-lg flex items-center justify-center animate-ping">
                   <div class="w-2 h-2 bg-white rounded-full"></div>
                 </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        }),
        interactive: false
      });
      centerMarker.addTo(group);
    }

    // 3. Render temporary coordinate drawing in progress
    if (tempCoords.length > 0) {
      tempCoords.forEach((c) => {
        const vMarker = L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: 'temp-vertex-icon',
            html: `<div class="w-3.5 h-3.5 rounded-full bg-yellow-500 border border-white shadow-md"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          }),
          interactive: false
        });
        vMarker.addTo(group);
      });

      const latlngs = tempCoords.map(c => [c.lat, c.lng] as [number, number]);
      if (drawMode === 'LineString') {
        const polyline = L.polyline(latlngs, {
          color: editorColor,
          weight: 3,
          opacity: 0.8,
          dashArray: '5, 5'
        });
        polyline.addTo(group);
      } else if (drawMode === 'Polygon') {
        const polygon = L.polygon(latlngs, {
          color: editorColor,
          weight: 3,
          opacity: 0.8,
          fillColor: editorColor,
          fillOpacity: 0.2,
          dashArray: '5, 5'
        });
        polygon.addTo(group);
      }
    }
  }, [
    assets,
    showPoints,
    showLines,
    showPolygons,
    radiusCenter,
    spatialFilterMode,
    searchRadius,
    tempCoords,
    drawMode,
    editorColor
  ]);

  // Watch Authentication
  useEffect(() => {
    // Check local storage for custom user login first
    const savedToken = localStorage.getItem('ptsl_custom_token');
    const savedUserData = localStorage.getItem('ptsl_custom_user');
    if (savedToken && savedUserData) {
      setUserToken(savedToken);
      setUser(JSON.parse(savedUserData));
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const customTokenPresent = localStorage.getItem('ptsl_custom_token');
      if (customTokenPresent) return;

      setUser(currentUser);
      if (currentUser) {
        const token = await currentUser.getIdToken();
        setUserToken(token);
        // Sync user profile to backend
        try {
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (err) {
          console.error('Error syncing user with database:', err);
        }
      } else {
        setUserToken(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch assets from PostGIS backend
  const fetchAssets = async (filters: { bbox?: string; lat?: number; lng?: number; radius?: number } = {}) => {
    setAssetsLoading(true);
    try {
      let queryUrl = '/api/assets';
      const params = new URLSearchParams();
      
      if (filters.bbox) {
        params.append('bbox', filters.bbox);
      } else if (filters.lat !== undefined && filters.lng !== undefined) {
        params.append('lat', filters.lat.toString());
        params.append('lng', filters.lng.toString());
        params.append('radius', (filters.radius || 20000).toString());
      }

      const queryString = params.toString();
      if (queryString) {
        queryUrl += `?${queryString}`;
      }

      const headers: HeadersInit = {};
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const res = await fetch(queryUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      } else {
        console.error('Failed to fetch assets:', res.statusText);
      }
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setAssetsLoading(false);
    }
  };

  // Re-fetch assets when user status or token changes
  useEffect(() => {
    fetchAssets();
  }, [userToken]);

  // Authenticate user (Open custom login modal)
  const handleSignIn = async () => {
    setLoginError('');
    setShowLoginModal(true);
  };

  // Log out user
  const handleSignOut = async () => {
    try {
      localStorage.removeItem('ptsl_custom_token');
      localStorage.removeItem('ptsl_custom_user');
      setUser(null);
      setUserToken(null);
      await signOut(auth);
      setSelectedAsset(null);
      alert('✓ DATA VALID: Berhasil log out dari aplikasi.');
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  // Handle custom login submit
  const handleCustomLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('ptsl_custom_token', data.token);
        localStorage.setItem('ptsl_custom_user', JSON.stringify(data.user));
        setUser(data.user);
        setUserToken(data.token);
        setShowLoginModal(false);
        setLoginUsername('');
        setLoginPassword('');
        alert(`✓ DATA VALID: Login berhasil! Selamat datang kembali, ${data.user.displayName}.`);
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Username atau password salah.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Terjadi kesalahan jaringan atau server.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Click handler on map for drawing geometries and placing radius probes
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const clickedLat = e.latLng.lat();
    const clickedLng = e.latLng.lng();

    // 1. Handle Radius spatial filter selection
    if (spatialFilterMode === 'Radius') {
      setRadiusCenter({ lat: clickedLat, lng: clickedLng });
      fetchAssets({
        lat: clickedLat,
        lng: clickedLng,
        radius: searchRadius
      });
      return;
    }

    // 2. Handle Drawing point, line, or polygon
    if (drawMode === 'Point') {
      const newPoint: Asset = {
        id: -1, // -1 denotes a new temporary asset
        userId: null,
        name: 'New Point Asset',
        description: '',
        type: 'Point',
        coordinates: { lat: clickedLat, lng: clickedLng },
        properties: { color: editorColor }
      };
      setTempCoords([]);
      openEditorForAsset(newPoint);
      setDrawMode('None');
    } else if (drawMode === 'LineString' || drawMode === 'Polygon') {
      setTempCoords((prev) => [...prev, { lat: clickedLat, lng: clickedLng }]);
    }
  };

  // Complete drawing for multi-point features
  const completeDrawing = () => {
    if (tempCoords.length < 2 && drawMode === 'LineString') return;
    if (tempCoords.length < 3 && drawMode === 'Polygon') return;

    const newAsset: Asset = {
      id: -1,
      userId: null,
      name: `New ${drawMode} Asset`,
      description: '',
      type: drawMode,
      coordinates: [...tempCoords],
      properties: {
        color: editorColor,
        fillColor: editorFillColor,
        strokeWidth: editorStrokeWidth,
        fillOpacity: editorFillOpacity,
      }
    };

    setTempCoords([]);
    openEditorForAsset(newAsset);
    setDrawMode('None');
  };

  // Open asset in edit drawer
  const openEditorForAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsEditing(true);
    setEditorName(asset.name);
    setEditorDescription(asset.description || '');
    setEditorColor(asset.properties?.color || '#4285F4');
    setEditorFillColor(asset.properties?.fillColor || '#4285F4');
    setEditorStrokeWidth(asset.properties?.strokeWidth || 3);
    setEditorFillOpacity(asset.properties?.fillOpacity || 0.3);

    // Auto center map on selection
    centerMapOnAsset(asset);
  };

  // Save drew or updated asset
  const handleSaveAsset = async () => {
    if (!selectedAsset) return;

    const body = {
      name: editorName,
      description: editorDescription,
      type: selectedAsset.type,
      coordinates: selectedAsset.coordinates,
      properties: {
        color: editorColor,
        fillColor: editorFillColor,
        strokeWidth: editorStrokeWidth,
        fillOpacity: editorFillOpacity,
      }
    };

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    try {
      let res;
      if (selectedAsset.id === -1) {
        // Create new
        res = await fetch('/api/assets', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      } else {
        // Update existing
        res = await fetch(`/api/assets/${selectedAsset.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });
      }

      if (res.ok) {
        const saved = await res.json();
        // Refresh the list
        fetchAssets();
        setSelectedAsset(null);
        setIsEditing(false);
      } else {
        const errData = await res.json();
        alert(`Failed to save: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error saving asset:', err);
    }
  };

  // Delete an asset from PostGIS
  const handleDeleteAsset = async (id: number) => {
    if (id === -1) {
      setSelectedAsset(null);
      setIsEditing(false);
      return;
    }

    if (!confirm('Are you sure you want to delete this geospatial asset?')) return;

    const headers: HeadersInit = {};
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        fetchAssets();
        setSelectedAsset(null);
        setIsEditing(false);
      } else {
        const errData = await res.json();
        alert(`Failed to delete: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Error deleting asset:', err);
    }
  };

  // Handle KML upload and parse
  const handleKmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseKML(text);
        if (parsed.length === 0) {
          alert('Format KML tidak dikenali atau tidak memiliki koordinat Point, LineString, atau Polygon.');
        } else {
          setImportedKmlList(parsed);
          setIsKmlModalOpen(true);
          alert(`✓ DATA VALID: Berhasil membaca file KML! Menemukan ${parsed.length} bidang lahan terdeteksi. Silakan tinjau dan klik "Import to Database" untuk menyimpan.`);
        }
      } catch (err) {
        console.error('KML parsing error:', err);
        alert('Gagal membaca file KML. Pastikan file merupakan format KML XML yang valid.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  // Confirm and upload imported KML elements to database
  const handleImportKmlToDatabase = async () => {
    if (importedKmlList.length === 0) return;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    try {
      const res = await fetch('/api/assets/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: importedKmlList })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✓ DATA VALID: Unggah data KML berhasil! ${data.count} bidang data lahan telah terunggah dan disimpan ke dalam database.`);
        setImportedKmlList([]);
        setIsKmlModalOpen(false);
        fetchAssets();
      } else {
        const errData = await res.json();
        alert(`Gagal mengimpor KML: ${errData.error || res.statusText}`);
      }
    } catch (err) {
      console.error('Bulk import error:', err);
      alert('Terjadi kesalahan jaringan saat mengunggah KML.');
    }
  };

  // Hot-link function to select and pan to asset on map
  const handleSelectAssetAndGoToMap = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsEditing(true);
    setEditorName(asset.name);
    setEditorDescription(asset.description || '');
    setEditorColor(asset.properties?.color || '#4285F4');
    setEditorFillColor(asset.properties?.fillColor || '#4285F4');
    setEditorStrokeWidth(asset.properties?.strokeWidth || 3);
    setEditorFillOpacity(asset.properties?.fillOpacity || 0.3);
    setActiveTab('map');
    
    // Smooth center focus
    setTimeout(() => {
      centerMapOnAsset(asset);
    }, 200);
  };

  // Download all database assets as KML
  const handleExportAllToKml = () => {
    if (assets.length === 0) {
      alert('No assets available to export.');
      return;
    }
    const kmlText = exportToKML(assets);
    const blob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'geodata-assets-export.kml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 font-sans text-slate-800 overflow-hidden" id="app_root">
      
      {/* 0. APP TOP HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 flex flex-row items-center justify-between px-4 md:px-6 z-20 shadow-sm flex-shrink-0" id="app_header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm shadow-indigo-600/20 flex-shrink-0">
            <Compass className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1">
              <span className="hidden sm:inline">GeoData Manager</span>
              <span className="inline sm:hidden">GeoData</span>
              <span className="text-slate-400 font-normal text-[9px] md:text-[11px] bg-slate-100 px-1 py-0.5 rounded-md">v2.4</span>
            </h1>
          </div>
        </div>

        {/* Center Navigation Tabs (Hidden on mobile, visible on desktop) */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/45">
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-white text-slate-900 border border-slate-200/50 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-indigo-500" />
            Peta Utama
          </button>
          <button
            onClick={() => setActiveTab('pemohon')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'pemohon'
                ? 'bg-white text-slate-900 border border-slate-200/50 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            Input Pemohon
          </button>
          <button
            onClick={() => setActiveTab('data_summary')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'data_summary'
                ? 'bg-white text-slate-900 border border-slate-200/50 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            Daftar & Rekap
          </button>
        </div>

        {/* Right side Profile & Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* DB Status indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span className="font-semibold text-slate-600 text-[11px]">PostGIS Live</span>
          </div>

          {authLoading ? (
            <div className="flex items-center text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-1 md:gap-2">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 text-xs font-bold font-mono shadow-inner flex-shrink-0">
                {user.email?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <span className="text-[11px] md:text-xs font-semibold text-slate-700 max-w-[80px] md:max-w-[120px] truncate hidden sm:inline">
                {user.email}
              </span>
              <button 
                onClick={handleSignOut}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[11px] md:text-xs font-bold transition-all border border-indigo-100 flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" /> Login
            </button>
          )}

          <button
            onClick={handleExportAllToKml}
            className="bg-indigo-600 hover:bg-indigo-750 text-white px-2.5 py-1.5 rounded-lg text-[11px] md:text-xs font-bold shadow-sm shadow-indigo-600/10 transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            <Download className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span>KML</span>
          </button>
        </div>
      </header>

      {/* Main workspace container splitting sidebar, map, and editor */}
      <main className="flex-1 flex overflow-hidden" id="app_main">

        {/* 1. LEFT CONTROL PANEL (SIDEBAR) */}
        <div className={`w-full md:w-80 flex-shrink-0 flex flex-col bg-slate-50 border-r border-slate-200 z-[1020] ${
          activeTab === 'map' 
            ? (showSidebarMobile ? 'fixed inset-y-0 left-0 md:relative md:flex' : 'hidden md:flex') 
            : 'hidden'
        }`} id="sidebar_container">
          
          {/* Mobile close button inside sidebar header */}
          <div className="flex md:hidden items-center justify-between p-4 bg-slate-100 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-800">Panel Kontrol Peta</span>
            <button 
              onClick={() => setShowSidebarMobile(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
          
          {/* Quick upload card matching theme */}
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 cursor-pointer transition-all">
              <Upload className="w-4 h-4 text-slate-500" />
              <span>{isUploading ? 'Parsing...' : 'Upload KML File'}</span>
              <input 
                type="file" 
                accept=".kml,.xml" 
                onChange={handleKmlUpload} 
                className="hidden" 
              />
            </label>
            <button 
              onClick={() => fetchAssets()} 
              className="p-2 bg-white border border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-lg text-slate-500 hover:text-indigo-600 transition-all shadow-sm"
              title="Refresh Database Assets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

          {/* Main interactive functions menu */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5" id="controls_body">

            {/* B. Manual Drawing / Create Assets */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-indigo-500" /> Draw Geometry on Map
              </h3>
              
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => {
                      setDrawMode(drawMode === 'Point' ? 'None' : 'Point');
                      setTempCoords([]);
                      setSpatialFilterMode('None');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                      drawMode === 'Point'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Point</span>
                  </button>
                  <button
                    onClick={() => {
                      setDrawMode(drawMode === 'LineString' ? 'None' : 'LineString');
                      setTempCoords([]);
                      setSpatialFilterMode('None');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                      drawMode === 'LineString'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>Line</span>
                  </button>
                  <button
                    onClick={() => {
                      setDrawMode(drawMode === 'Polygon' ? 'None' : 'Polygon');
                      setTempCoords([]);
                      setSpatialFilterMode('None');
                    }}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center gap-1 ${
                      drawMode === 'Polygon'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    <span>Polygon</span>
                  </button>
                </div>

                {drawMode !== 'None' && (
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-2 animate-fade-in">
                    <p className="font-bold flex items-center gap-1.5 text-indigo-800">
                      <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                      Drawing: {drawMode}
                    </p>
                    <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                      {drawMode === 'Point' 
                        ? 'Click anywhere on the map to drop a single attribute point.'
                        : 'Click sequential points on the map. Finish by clicking the "Complete Design" button below.'}
                    </p>
                    
                    {(drawMode === 'LineString' || drawMode === 'Polygon') && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-mono text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md font-semibold">
                          {tempCoords.length} point{tempCoords.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => setTempCoords([])}
                            className="text-[10px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded-md transition-colors"
                          >
                            Reset
                          </button>
                          <button 
                            onClick={completeDrawing}
                            disabled={(drawMode === 'LineString' && tempCoords.length < 2) || (drawMode === 'Polygon' && tempCoords.length < 3)}
                            className="text-[10px] text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2 py-1 rounded-md transition-all font-semibold inline-flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3 h-3" /> Complete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* C. PostGIS Spatial Query Console */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" /> PostGIS Spatial Queries
              </h3>
              
              <div className="space-y-3 bg-white p-3.5 border border-slate-200 rounded-xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Filter Engine</span>
                  <span className="text-[10px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded font-bold">PostGIS</span>
                </div>

                {/* Filter mode switches */}
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px]">
                  <button
                    onClick={() => {
                      setSpatialFilterMode('None');
                      setRadiusCenter(null);
                      setSyncViewportActive(false);
                      fetchAssets();
                    }}
                    className={`py-1 px-1.5 rounded font-semibold transition-all ${
                      spatialFilterMode === 'None'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    All Assets
                  </button>
                  <button
                    onClick={() => {
                      setSpatialFilterMode('BBox');
                      setRadiusCenter(null);
                      setSyncViewportActive(true);
                      if (viewportBounds) {
                        fetchAssets({ bbox: viewportBounds });
                      }
                    }}
                    className={`py-1 px-1.5 rounded font-semibold transition-all ${
                      spatialFilterMode === 'BBox'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Viewport
                  </button>
                  <button
                    onClick={() => {
                      setSpatialFilterMode('Radius');
                      setSyncViewportActive(false);
                      setRadiusCenter(null);
                    }}
                    className={`py-1 px-1.5 rounded font-semibold transition-all ${
                      spatialFilterMode === 'Radius'
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Radius
                  </button>
                </div>

                {/* Viewport Intersect Instructions */}
                {spatialFilterMode === 'BBox' && (
                  <div className="space-y-2.5 animate-fade-in">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Queries database using <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono font-semibold">ST_Intersects</code>. Showing only assets inside current map limits.
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-150">
                      <input 
                        type="checkbox" 
                        checked={syncViewportActive} 
                        onChange={(e) => {
                          setSyncViewportActive(e.target.checked);
                          if (e.target.checked && viewportBounds) {
                            fetchAssets({ bbox: viewportBounds });
                          } else if (!e.target.checked) {
                            fetchAssets();
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 bg-white focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-600 font-semibold">Sync with map movement</span>
                    </label>
                    {!syncViewportActive && (
                      <button
                        onClick={() => {
                          if (viewportBounds) fetchAssets({ bbox: viewportBounds });
                        }}
                        className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
                      >
                        <Search className="w-3.5 h-3.5" /> Search Viewport
                      </button>
                    )}
                  </div>
                )}

                {/* Radius Query instructions & controls */}
                {spatialFilterMode === 'Radius' && (
                  <div className="space-y-3 animate-fade-in">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Uses <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono font-semibold">ST_DWithin</code> in SQL. Click anywhere on the map to list all spatial assets within radius.
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold">Search Radius</span>
                        <span className="font-mono text-indigo-600 font-bold">{searchRadius / 1000} km</span>
                      </div>
                      <input 
                        type="range" 
                        min="1000" 
                        max="100000" 
                        step="1000"
                        value={searchRadius}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setSearchRadius(val);
                          if (radiusCenter) {
                            fetchAssets({ lat: radiusCenter.lat, lng: radiusCenter.lng, radius: val });
                          }
                        }}
                        className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {radiusCenter ? (
                      <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl flex flex-col gap-1 text-[11px]">
                        <span className="text-indigo-600 font-bold font-mono uppercase text-[9px] tracking-wider">Active Probe Center</span>
                        <span className="text-slate-700 truncate font-mono">Lat: {radiusCenter.lat.toFixed(5)}, Lng: {radiusCenter.lng.toFixed(5)}</span>
                        <button
                          onClick={() => {
                            setRadiusCenter(null);
                            fetchAssets();
                          }}
                          className="text-left text-red-600 hover:text-red-700 font-bold mt-1"
                        >
                          Clear Probe
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-xl flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                        <span>Ready! Click anywhere on the map to execute the spatial radius query.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* D. Layer List & Legend Visibility toggles */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" /> Layer Management
              </h3>
              
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm">
                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 bg-blue-50 text-blue-600 rounded border border-blue-100">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-950">Point Layers</span>
                  </div>
                  <button 
                    onClick={() => setShowPoints(!showPoints)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPoints ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 bg-red-50 text-red-600 rounded border border-red-100">
                      <Compass className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-950">Line Layers</span>
                  </div>
                  <button 
                    onClick={() => setShowLines(!showLines)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showLines ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>
                </label>

                <label className="flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-950">Polygon Layers</span>
                  </div>
                  <button 
                    onClick={() => setShowPolygons(!showPolygons)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPolygons ? <Eye className="w-4 h-4 text-indigo-500" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                  </button>
                </label>
              </div>
            </div>

            {/* E. Geospatial Asset List (Drizzle results) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <MapIcon className="w-3.5 h-3.5 text-indigo-500" /> Loaded Assets ({assets.length})
                </h3>
              </div>
              
              {assets.length === 0 ? (
                <div className="p-5 border border-slate-200 rounded-xl text-center bg-white shadow-sm">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No assets found. Upload KML files or use drawing tools to add assets in the database.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1" id="asset_list">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => openEditorForAsset(asset)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 group ${
                        selectedAsset?.id === asset.id
                          ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div 
                        className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" 
                        style={{ backgroundColor: asset.properties?.color || '#4285F4' }}
                      />
                      <div className="overflow-hidden flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-bold truncate transition-colors ${
                            selectedAsset?.id === asset.id ? 'text-indigo-900' : 'text-slate-700 group-hover:text-indigo-600'
                          }`}>
                            {asset.name}
                          </h4>
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
                            {asset.type}
                          </span>
                        </div>
                        {asset.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {asset.description}
                          </p>
                        )}
                        {asset.distance !== undefined && asset.distance !== null && (
                          <p className="text-[10px] text-indigo-600 font-mono font-bold mt-1">
                            Distance: {(asset.distance / 1000).toFixed(2)} km
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer Credit & Status Line (Humble & Professional) */}
          <div className="p-3 bg-white border-t border-slate-200 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span>GeoData Manager</span>
            <span>•</span>
            <span>Leaflet, OSM & PostGIS</span>
          </div>

        </div>

      {/* 2. MAP COMPONENT (MAIN BODY) */}
      <div className={`flex-1 h-full relative ${activeTab === 'map' ? '' : 'hidden'}`} id="map_viewport">
        
        {/* Toggleable base map controls in map corner */}
        <div className="absolute top-4 left-4 z-[1010] flex gap-1 p-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg shadow-slate-200/40">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapType === 'roadmap' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Vector Map
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapType === 'satellite' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Satellite View
          </button>
          <button
            onClick={() => setMapType('terrain')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapType === 'terrain' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Terrain Map
          </button>
        </div>

        {/* GPS Location Button (Top-Right of Map) */}
        <div className="absolute top-4 right-4 z-[1010]">
          <button
            onClick={handleGpsLocation}
            className="px-4 py-2.5 bg-white/95 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all cursor-pointer"
            title="Temukan Lokasi Saya Menggunakan GPS"
          >
            <Compass className="w-4 h-4 text-indigo-600 animate-pulse" />
            <span>GPS Saya</span>
          </button>
        </div>

        {/* Mobile Control Panel Toggle Button (Bottom-Left) */}
        <div className="absolute bottom-4 left-4 z-[1010] md:hidden">
          <button
            onClick={() => setShowSidebarMobile(!showSidebarMobile)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white border border-indigo-500 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer"
            title="Buka/Tutup Panel Kontrol & Filter"
          >
            <Layers className="w-4 h-4" />
            <span>{showSidebarMobile ? 'Tutup Kontrol' : 'Buka Kontrol'}</span>
          </button>
        </div>

        {/* Real Map */}
        <div 
          ref={mapContainerRef} 
          className="w-full h-full z-0" 
          style={{ outline: 'none' }}
        />

        {/* Floating action reminder when in interactive mode */}
        {drawMode !== 'None' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1010] px-6 py-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-3 animate-bounce">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
            <span>Interactive Tool: Draw {drawMode} by clicking on map</span>
            {tempCoords.length > 0 && (
              <button 
                onClick={completeDrawing} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full text-[11px] font-bold transition-all shadow-sm cursor-pointer"
              >
                Done ({tempCoords.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. RIGHT ATTRIBUTE DRAWER & STYLE MANAGER */}
      {isEditing && selectedAsset && (
        <div className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-slate-200 z-10 shadow-lg animate-slide-in" id="editor_drawer">
          
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                <Edit3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {selectedAsset.id === -1 ? 'Create Asset' : 'Asset Inspector'}
              </h3>
            </div>
            <button 
              onClick={() => {
                setSelectedAsset(null);
                setIsEditing(false);
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Meta statistics */}
            <div className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl flex flex-col gap-1.5 text-[11px] text-slate-600">
              <div className="flex justify-between">
                <span>Geometry Type:</span>
                <span className="font-mono text-slate-800 font-bold uppercase">{selectedAsset.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Asset Mode:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {selectedAsset.id === -1 ? 'Temporary Draft' : 'Saved in PostGIS'}
                </span>
              </div>
              {selectedAsset.id !== -1 && (
                <div className="flex justify-between">
                  <span>Ownership:</span>
                  <span className="font-mono text-indigo-600 font-bold flex items-center gap-1">
                    {selectedAsset.userId ? 'Sync Private' : 'Guest Public'}
                  </span>
                </div>
              )}
            </div>

            {/* Editable Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Asset Name
                </label>
                <input 
                  type="text" 
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="Enter asset name"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Asset Description / Attributes
                </label>
                <textarea 
                  value={editorDescription}
                  onChange={(e) => setEditorDescription(e.target.value)}
                  placeholder="Enter custom metadata, notes, or attributes..."
                  rows={3}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all resize-none font-medium"
                />
              </div>
            </div>

            {/* Integrated Applicant Data Block */}
            {selectedAsset.properties?.hasApplicant && selectedAsset.properties?.applicantData && (
              <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3.5 space-y-3 animate-fade-in text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Terintegrasi Pemohon PTSL
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold tracking-wider uppercase">NAMA PEMOHON:</span>
                  <span className="text-slate-800 font-bold text-xs">{(selectedAsset.properties.applicantData as any).namaPemohon}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-slate-400 block text-[9px] tracking-wider uppercase">NO REGISTER:</span>
                    <span className="text-slate-700 font-semibold font-mono text-[10px]">{(selectedAsset.properties.applicantData as any).noRegister || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] tracking-wider uppercase">NIK:</span>
                    <span className="text-slate-700 font-semibold font-mono text-[10px]">{(selectedAsset.properties.applicantData as any).nik || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[9px] tracking-wider uppercase">DESA / KELURAHAN:</span>
                    <span className="text-slate-700 font-semibold text-[11px]">{(selectedAsset.properties.applicantData as any).desa || '-'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[9px] tracking-wider uppercase">LUAS TANAH (M²):</span>
                    <span className="text-slate-800 font-bold text-[11px]">{(selectedAsset.properties.applicantData as any).luasM2 || '-'} m²</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('data_summary');
                  }}
                  className="w-full mt-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/10"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Lihat Seluruh 70 Kolom Data
                </button>
              </div>
            )}

            {/* Styling Customization options */}
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-indigo-500" /> Vector Layer Styling
              </h4>

              {/* Presets color swatches */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Stroke / Point Color
                </label>
                <div className="grid grid-cols-8 gap-1 mb-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditorColor(color)}
                      className={`w-5 h-5 rounded-md border border-slate-200 shadow-sm relative transition-all hover:scale-110 ${
                        editorColor === color ? 'ring-2 ring-indigo-500 scale-105' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={editorColor}
                    onChange={(e) => setEditorColor(e.target.value)}
                    className="w-6 h-6 rounded bg-transparent border border-slate-200 cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-slate-500 font-semibold">{editorColor.toUpperCase()}</span>
                </div>
              </div>

              {/* Line thickness style */}
              {(selectedAsset.type === 'LineString' || selectedAsset.type === 'Polygon') && (
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Stroke Thickness</span>
                    <span className="font-mono text-slate-700 font-bold">{editorStrokeWidth}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={editorStrokeWidth}
                    onChange={(e) => setEditorStrokeWidth(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              )}

              {/* Polygon fill settings */}
              {selectedAsset.type === 'Polygon' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Polygon Fill Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={editorFillColor}
                        onChange={(e) => setEditorFillColor(e.target.value)}
                        className="w-6 h-6 rounded bg-transparent border border-slate-200 cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">{editorFillColor.toUpperCase()}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Fill Opacity</span>
                      <span className="font-mono text-slate-700 font-bold">{Math.round(editorFillOpacity * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.05" 
                      max="0.95" 
                      step="0.05"
                      value={editorFillOpacity}
                      onChange={(e) => setEditorFillOpacity(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* Save & Delete actions */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 flex flex-col gap-2">
            <button
              onClick={handleSaveAsset}
              disabled={!editorName}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save Spatial Object
            </button>
            <button
              onClick={() => handleDeleteAsset(selectedAsset.id)}
              className="w-full py-2.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-600 hover:text-red-600 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Delete Asset
            </button>
          </div>

        </div>
      )}

      {activeTab === 'pemohon' && (
        <ApplicantForm 
          assets={assets} 
          userToken={userToken} 
          onRefreshAssets={fetchAssets} 
          onNavigateToMap={() => setActiveTab('map')} 
          onSelectAssetAndGoToMap={handleSelectAssetAndGoToMap}
        />
      )}

      {activeTab === 'data_summary' && (
        <ApplicantSummary 
          assets={assets} 
          userToken={userToken} 
          onRefreshAssets={fetchAssets} 
          onSelectAssetAndGoToMap={handleSelectAssetAndGoToMap} 
          onNavigateToTab={(tab) => setActiveTab(tab)}
        />
      )}

      </main>

      {/* 4. KML BATCH IMPORT MODAL */}
      {isKmlModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl animate-scale-in">
            
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 animate-pulse">
                  <MapIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  Review Imported KML layers ({importedKmlList.length})
                </h3>
              </div>
              <button 
                onClick={() => setIsKmlModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                The KML file was parsed successfully! Below are the geometries translated. Click "Import to Database" to insert them directly into PostgreSQL.
              </p>

              <div className="space-y-2">
                {importedKmlList.map((item, index) => (
                  <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                    <div 
                      className="w-2.5 h-2.5 rounded-full mt-1"
                      style={{ backgroundColor: item.properties?.color || '#4285F4' }}
                    />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-800 truncate max-w-[200px]">
                          {item.name}
                        </h4>
                        <span className="text-[9px] font-mono px-1 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-500 font-semibold uppercase">
                          {item.type}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[10px] text-slate-500 truncate max-w-[300px] mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                onClick={() => setIsKmlModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImportKmlToDatabase}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                Import to Database
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. CUSTOM USERNAME AND PASSWORD LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 bg-gradient-to-br from-indigo-50 to-white border-b border-slate-100 relative">
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center text-center mt-2">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center mb-3 shadow-md shadow-indigo-600/20">
                  <UserIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Login Aplikasi PTSL
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Masukkan username dan password Anda untuk masuk ke sistem
                </p>
              </div>
            </div>

            <form onSubmit={handleCustomLoginSubmit} className="p-6 space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
                  ⚠ {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Contoh: admin"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contoh: admin123"
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                {loginSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Masuk Aplikasi</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden h-16 bg-white border-t border-slate-200 flex items-center justify-around z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] flex-shrink-0 px-2 pb-safe">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer ${
            activeTab === 'map' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'map' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight">Peta Utama</span>
        </button>
        
        <button
          onClick={() => setActiveTab('pemohon')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer ${
            activeTab === 'pemohon' ? 'text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileSpreadsheet className={`w-5 h-5 ${activeTab === 'pemohon' ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight">Input Pemohon</span>
        </button>
        
        <button
          onClick={() => setActiveTab('data_summary')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-all cursor-pointer ${
            activeTab === 'data_summary' ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'data_summary' ? 'text-indigo-600' : 'text-slate-400'}`} />
          <span className="text-[10px] tracking-tight">Daftar Rekap</span>
        </button>
      </div>

    </div>
  );
}

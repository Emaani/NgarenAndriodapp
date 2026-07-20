import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/theme';
import { AnimalMarker } from '@/data/types';
import { Geofence } from '@/data/mock';
import { InteractiveMap } from './InteractiveMap';

export interface LiveMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitAll: () => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  showUser: (lat: number, lng: number) => void;
}

/**
 * A real, tiled map for live tracking: OpenStreetMap tiles rendered by Leaflet
 * inside a WebView. Animals are plotted at their actual GPS coordinates, farm
 * geofences are drawn as polygons, and pinch / double-tap / button zoom and pan
 * are handled natively by Leaflet.
 *
 * OSM needs no API key, so this works on any device out of the box. The bridge
 * below (setData / flyTo / showUser + the `select` message) is deliberately
 * provider-agnostic, so swapping in Google Maps later only means replacing the
 * HTML — the React surface stays identical.
 */
const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8EDE4; }
  .leaflet-container { font-family: -apple-system, Roboto, sans-serif; }
  .pin {
    border-radius: 50%; border: 2.5px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    width: 100%; height: 100%;
  }
  .pin.sel { box-shadow: 0 0 0 4px rgba(109,135,79,0.45), 0 1px 4px rgba(0,0,0,0.4); }
  .lbl { font-size: 11px; font-weight: 700; }
  .userdot {
    width: 100%; height: 100%; border-radius: 50%;
    background: #1D4ED8; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(29,78,216,0.25);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };

  // zoomControl off — the app renders its own themed +/- buttons.
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([0.3476, 32.5825], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 2,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var fenceLayer = L.layerGroup().addTo(map);
  var userMarker = null;
  var byId = {};
  var selectedId = null;
  var bounds = null;

  function colorFor(m) {
    if (m.status !== 'active') return '#9AA0A6';
    if (m.accuracy === 'Good') return '#16A34A';
    if (m.accuracy === 'Fair') return '#F59E0B';
    return '#EF4444';
  }

  function iconFor(m, selected) {
    var size = selected ? 26 : 20;
    return L.divIcon({
      className: '',
      html: '<div class="pin' + (selected ? ' sel' : '') + '" style="background:' + colorFor(m) + '"></div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  window.setData = function (markers, fences, selId) {
    selectedId = selId === undefined ? selectedId : selId;
    markerLayer.clearLayers();
    fenceLayer.clearLayers();
    byId = {};
    var pts = [];

    fences.forEach(function (f) {
      var ring = f.ring.map(function (p) { return [p.lat, p.lng]; });
      if (ring.length < 3) return;
      L.polygon(ring, {
        color: '#6D874F', weight: 2, opacity: 0.9,
        fillColor: '#6D874F', fillOpacity: 0.10, dashArray: '6 4'
      }).bindTooltip(f.name, { permanent: false, direction: 'center' }).addTo(fenceLayer);
      ring.forEach(function (p) { pts.push(p); });
    });

    markers.forEach(function (m) {
      var mk = L.marker([m.lat, m.lng], { icon: iconFor(m, m.animalId === selectedId) })
        .bindTooltip(m.tag, { direction: 'top', offset: [0, -12], className: 'lbl' })
        .addTo(markerLayer);
      mk.on('click', function () { post({ type: 'select', animalId: m.animalId }); });
      byId[m.animalId] = { marker: mk, data: m };
      pts.push([m.lat, m.lng]);
    });

    if (pts.length > 0) {
      bounds = L.latLngBounds(pts);
      if (!window.__didFit) { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 }); window.__didFit = true; }
    }
    post({ type: 'data', count: markers.length });
  };

  window.setSelected = function (id) {
    selectedId = id;
    Object.keys(byId).forEach(function (k) {
      var e = byId[k];
      e.marker.setIcon(iconFor(e.data, String(e.data.animalId) === String(id)));
    });
  };

  window.flyTo = function (lat, lng, zoom) { map.flyTo([lat, lng], zoom || 17, { duration: 0.6 }); };
  window.zoomIn = function () { map.zoomIn(); };
  window.zoomOut = function () { map.zoomOut(); };
  window.fitAll = function () {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };
  window.showUser = function (lat, lng) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([lat, lng], {
      icon: L.divIcon({ className: '', html: '<div class="userdot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
    }).bindTooltip('You are here', { direction: 'top', offset: [0, -10] }).addTo(map);
    map.flyTo([lat, lng], 16, { duration: 0.6 });
  };

  map.whenReady(function () { post({ type: 'ready' }); });
</script>
</body>
</html>`;

export const LiveMap = forwardRef<
  LiveMapHandle,
  {
    markers: AnimalMarker[];
    geofences: Geofence[];
    selectedId?: number | null;
    onSelectMarker: (m: AnimalMarker) => void;
  }
>(function LiveMap({ markers, geofences, selectedId, onSelectMarker }, ref) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  // Tiles and Leaflet come over the network. If either is unreachable (rural
  // connectivity, blocked CDN) we fall back to the offline vector map rather
  // than showing an empty grey page.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 12_000);
    return () => clearTimeout(timer);
  }, [ready, failed]);

  const run = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    zoomIn: () => run('window.zoomIn && window.zoomIn()'),
    zoomOut: () => run('window.zoomOut && window.zoomOut()'),
    fitAll: () => run('window.fitAll && window.fitAll()'),
    flyTo: (lat, lng, zoom) => run(`window.flyTo && window.flyTo(${lat}, ${lng}, ${zoom ?? 17})`),
    showUser: (lat, lng) => run(`window.showUser && window.showUser(${lat}, ${lng})`),
  }));

  // Push data whenever it changes (and once the map signals it's ready).
  useEffect(() => {
    if (!ready) return;
    const payload = JSON.stringify(markers);
    const fences = JSON.stringify(geofences);
    run(`window.setData && window.setData(${payload}, ${fences}, ${selectedId ?? 'null'})`);
    // selectedId intentionally excluded — highlight is handled below so data
    // isn't rebuilt on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, geofences, run]);

  // Highlight the selected marker without rebuilding the layer.
  useEffect(() => {
    if (!ready) return;
    run(`window.setSelected && window.setSelected(${selectedId ?? 'null'})`);
  }, [ready, selectedId, run]);

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; animalId?: number };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'select' && msg.animalId !== undefined) {
        const found = markers.find((m) => m.animalId === msg.animalId);
        if (found) onSelectMarker(found);
      }
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  if (failed) {
    return (
      <InteractiveMap
        markers={markers}
        geofences={geofences}
        selectedId={selectedId}
        onSelectMarker={onSelectMarker}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#E8EDE4' }}>
      <WebView
        ref={webRef}
        source={{ html: LEAFLET_HTML }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => setFailed(true)}
        javaScriptEnabled
        domStorageEnabled
        // Leaflet handles its own pinch/double-tap zoom inside the page.
        setBuiltInZoomControls={false}
        scalesPageToFit={false}
        allowsInlineMediaPlayback
        style={{ flex: 1, backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: colors.background }}
      />
    </View>
  );
});

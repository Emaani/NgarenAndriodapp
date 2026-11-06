import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '@/theme';
import { Geofence } from '@/data/mock';
import { LatLng } from '@/lib/geo';
import { LEAFLET_CSS_B64, LEAFLET_JS_B64 } from './leafletAssets';

export interface FenceDrawMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitDraft: () => void;
}

/**
 * The boundary editor's map: the same bundled Leaflet + OpenStreetMap tiles as
 * the Track map. A tap on the map is sent back as a point; the screen decides
 * whether it is a polygon corner or a circle's centre. Other boundaries are
 * drawn faintly so a new paddock can be lined up against its neighbours.
 */
const DRAW_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
<script>
  (function () {
    var css = document.createElement('style');
    css.textContent = atob('${LEAFLET_CSS_B64}');
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.text = atob('${LEAFLET_JS_B64}');
    document.head.appendChild(js);
  })();
</script>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8EDE4; }
  .vtx { width: 100%; height: 100%; border-radius: 50%; background: #fff; border: 3px solid #3F5227; box-sizing: border-box; }
  .vtx.first { background: #3F5227; }
  .other-lbl { background: rgba(255,255,255,0.8); border: none; box-shadow: none; color: #555; font-size: 10px; font-weight: 700; padding: 0 4px; }
  .other-lbl::before { display: none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var post = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([0.3476, 32.5825], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, minZoom: 2, attribution: '&copy; OpenStreetMap' }).addTo(map);

  var otherLayer = L.layerGroup().addTo(map);
  var draftLayer = L.layerGroup().addTo(map);
  var draftBounds = null;
  var fitted = false;

  map.on('click', function (e) { post({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng }); });

  window.setOthers = function (fences) {
    otherLayer.clearLayers();
    var pts = [];
    fences.forEach(function (f) {
      var ring = f.ring.map(function (p) { return [p.lat, p.lng]; });
      if (ring.length < 3) return;
      L.polygon(ring, { color: '#888', weight: 1, opacity: 0.7, fillOpacity: 0.05, dashArray: '4 4', interactive: false })
        .bindTooltip(f.name, { permanent: true, direction: 'center', className: 'other-lbl' }).addTo(otherLayer);
      ring.forEach(function (p) { pts.push(p); });
    });
    if (!fitted && pts.length) { map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 17 }); fitted = true; }
  };

  window.setDraft = function (ring, vertices, color, keepOut) {
    draftLayer.clearLayers();
    var col = keepOut ? '#d9534f' : (color || '#6D874F');
    var latlngs = ring.map(function (p) { return [p.lat, p.lng]; });
    if (latlngs.length >= 3) {
      L.polygon(latlngs, { color: col, weight: 3, fillColor: col, fillOpacity: 0.2, interactive: false }).addTo(draftLayer);
    } else if (latlngs.length === 2) {
      L.polyline(latlngs, { color: col, weight: 3, interactive: false }).addTo(draftLayer);
    }
    vertices.forEach(function (p, i) {
      L.marker([p.lat, p.lng], {
        interactive: false,
        icon: L.divIcon({ className: '', html: '<div class="vtx' + (i === 0 ? ' first' : '') + '"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
      }).addTo(draftLayer);
    });
    draftBounds = latlngs.length ? L.latLngBounds(latlngs) : null;
    if (!fitted && draftBounds && latlngs.length >= 3) { map.fitBounds(draftBounds, { padding: [40, 40], maxZoom: 18 }); fitted = true; }
  };

  window.fitDraft = function () { if (draftBounds) map.fitBounds(draftBounds, { padding: [40, 40], maxZoom: 18 }); };
  window.flyTo = function (lat, lng, zoom) { fitted = true; map.flyTo([lat, lng], zoom || 17, { duration: 0.6 }); };

  map.whenReady(function () { post({ type: 'ready' }); });
</script>
</body>
</html>`;

export const FenceDrawMap = forwardRef<
  FenceDrawMapHandle,
  {
    ring: LatLng[];
    vertices: LatLng[];
    color: string;
    keepOut: boolean;
    others: Geofence[];
    onTap: (p: LatLng) => void;
  }
>(function FenceDrawMap({ ring, vertices, color, keepOut, others, onTap }, ref) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const run = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom) => run(`window.flyTo && window.flyTo(${lat}, ${lng}, ${zoom ?? 17})`),
    fitDraft: () => run('window.fitDraft && window.fitDraft()'),
  }));

  useEffect(() => {
    if (!ready) return;
    run(`window.setDraft && window.setDraft(${JSON.stringify(ring)}, ${JSON.stringify(vertices)}, ${JSON.stringify(color)}, ${keepOut})`);
  }, [ready, ring, vertices, color, keepOut, run]);

  // After the draft, so a boundary being edited is what the map zooms to.
  useEffect(() => {
    if (ready) run(`window.setOthers && window.setOthers(${JSON.stringify(others)})`);
  }, [ready, others, run]);

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string; lat?: number; lng?: number };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'tap' && typeof msg.lat === 'number' && typeof msg.lng === 'number') onTap({ lat: msg.lat, lng: msg.lng });
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#E8EDE4' }}>
      <WebView
        ref={webRef}
        source={{ html: DRAW_HTML }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setBuiltInZoomControls={false}
        scalesPageToFit={false}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: colors.background }}
      />
    </View>
  );
});

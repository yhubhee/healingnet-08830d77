// The hospital map in the app. No native map library: a small page kept inside the app is
// shown in a WebView; it loads MapLibre and OpenFreeMap tiles (no key, no paid service).
// Pins go in and taps come out as messages. Only ids and positions are given to the page:
// no hospital names and nothing about the patient except the blue dot. If the page cannot
// load (no internet), the screen falls back to the list.
import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { MAP_ATTRIBUTION, MAP_STYLE_URL, NIGERIA_CENTER, NIGERIA_ZOOM, type LatLng } from "@/shared/geo";
import { radius } from "@/theme";
import { Small } from "./ui";

export interface MapPinIn { id: string; lat: number; lng: number }

const MAPLIBRE = "https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl";
const BASE_URL = "https://map.healingnet.invalid/";

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}.css">
<style>html,body,#map{height:100%;margin:0;padding:0;background:#e8efee}.me{width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.35)}</style>
</head><body><div id="map"></div>
<script>
var send=function(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m))}catch(e){}};
var map=null,markers={},meMarker=null,pending=null,selected=null;
function draw(d){
  if(!map){pending=d;return}
  Object.keys(markers).forEach(function(k){markers[k].remove()});markers={};
  if(meMarker){meMarker.remove();meMarker=null}
  var b=new maplibregl.LngLatBounds(),n=0;
  (d.pins||[]).forEach(function(p){
    var m=new maplibregl.Marker({color:p.id===d.selected?"#E4572E":"#186E6A"}).setLngLat([p.lng,p.lat]).addTo(map);
    m.getElement().addEventListener("click",function(e){e.stopPropagation();send({type:"select",id:p.id})});
    markers[p.id]=m;b.extend([p.lng,p.lat]);n++;
  });
  if(d.me){var el=document.createElement("div");el.className="me";meMarker=new maplibregl.Marker({element:el}).setLngLat([d.me.lng,d.me.lat]).addTo(map);b.extend([d.me.lng,d.me.lat]);n++}
  if(d.fit){if(n>1)map.fitBounds(b,{padding:56,maxZoom:14,duration:0});else if(n===1)map.jumpTo({center:b.getCenter(),zoom:13})}
}
window.hnDraw=draw;
function start(){
  if(!window.maplibregl){send({type:"failed"});return}
  try{
    map=new maplibregl.Map({container:"map",style:"${MAP_STYLE_URL}",center:[${NIGERIA_CENTER.lng},${NIGERIA_CENTER.lat}],zoom:${NIGERIA_ZOOM},attributionControl:{compact:true}});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
    var ok=false;
    map.on("load",function(){ok=true;send({type:"ready"});if(pending){draw(pending);pending=null}});
    map.on("error",function(){if(!ok)send({type:"failed"})});
    map.on("click",function(){send({type:"select",id:null})});
  }catch(e){send({type:"failed"})}
}
</script>
<script src="${MAPLIBRE}.js" onload="start()" onerror="send({type:'failed'})"></script>
</body></html>`;

export default function HospitalMap({ pins, me, selectedId, onSelect, onFailed, height = 340 }: {
  pins: MapPinIn[]; me: LatLng | null; selectedId: string | null; onSelect: (id: string | null) => void; onFailed: () => void; height?: number;
}) {
  const web = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
  const ready = useRef(false);
  const fitted = useRef("");
  const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);

  // What the page is told to draw. Fits to the pins only when the set of pins changes.
  const payload = useMemo(() => {
    const key = pins.map((p) => p.id).join(",") + (me ? "|me" : "");
    return { key, js: (fit: boolean) => `window.hnDraw(${JSON.stringify({ pins, me, selected: selectedId, fit })});true;` };
  }, [pins, me, selectedId]);

  const push = () => {
    if (!ready.current) return;
    const fit = fitted.current !== payload.key;
    fitted.current = payload.key;
    web.current?.injectJavaScript(payload.js(fit));
  };
  useEffect(push, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  // No "ready" within 15 seconds (no internet, a blocked script): fall back to the list.
  useEffect(() => {
    giveUp.current = setTimeout(() => { if (!ready.current) onFailed(); }, 15_000);
    return () => { if (giveUp.current) clearTimeout(giveUp.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ gap: 4 }}>
      <View style={{ height, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#e8efee" }} accessible accessibilityLabel="Map of hospitals. The same hospitals are in the list.">
        <WebView
          ref={(r) => { web.current = r; }}
          source={{ html: PAGE, baseUrl: BASE_URL }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          geolocationEnabled={false}
          setSupportMultipleWindows={false}
          nestedScrollEnabled
          // The page never goes anywhere else (the attribution's links are not followed).
          onShouldStartLoadWithRequest={(r) => r.url === BASE_URL || r.url.startsWith("about:") || r.url.startsWith("data:")}
          onMessage={(e) => {
            try {
              const m = JSON.parse(e.nativeEvent.data) as { type?: string; id?: unknown };
              if (m.type === "ready") { ready.current = true; push(); }
              else if (m.type === "failed") onFailed();
              else if (m.type === "select") onSelect(typeof m.id === "string" ? m.id : null);
            } catch { /* not ours */ }
          }}
          onError={() => onFailed()}
          onRenderProcessGone={() => onFailed()}
        />
      </View>
      <Small style={{ fontSize: 11 }}>Map: {MAP_ATTRIBUTION} contributors</Small>
    </View>
  );
}

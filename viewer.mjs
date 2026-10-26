import {coordinateText, validCoordinate, nearestLane, findRoute, routePoints} from './routing.mjs';

const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
const COLORS = {driving: '#415766', parking: '#a598b4', restricted: 'url(#paint)', median: 'url(#paint)', biking: '#77a7a6', walking: '#c8beb0', sidewalk: '#c8beb0', shoulder: '#a8aba1', border: '#bcc1b8', curb: '#bcc1b8', green: '#9cb87e', junction: '#526772'};
const svgPath = points => points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
function element(tag, attributes, parent) { const e = document.createElementNS(NS, tag); for (const [name, value] of Object.entries(attributes)) e.setAttribute(name, value); parent.append(e); return e; }
const map = $('map'); let data, box, units = 1, mode = null, coordinate = null, start = null, end = null, activeRoute = null, toastTimer, gesture;

function notify(message) { clearTimeout(toastTimer); $('notification').textContent = message; $('notification').classList.add('visible'); toastTimer = setTimeout(() => $('notification').classList.remove('visible'), 2400); }
function point(event, matrix = map.getScreenCTM().inverse()) { const p = map.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const q = p.matrixTransform(matrix); return [q.x, q.y]; }
function setView() {
  map.setAttribute('viewBox', `${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`);
  const rect = map.getBoundingClientRect(); units = Math.max((box[2] - box[0]) / rect.width, (box[3] - box[1]) / rect.height);
  $('arrows').style.display = $('layer-roads').checked && $('layer-arrows').checked && units < 1.6 ? '' : 'none';
  for (const label of $('labels').children) label.setAttribute('font-size', 11 * units);
  drawPins();
}
function zoom(factor, centre = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]) { const span = box[2] - box[0]; if (span * factor < 22 || span * factor > 20000) return; box = box.map((v, i) => centre[i % 2] + (v - centre[i % 2]) * factor); setView(); }
function fit() { box = data.bounds.slice(); const px = (box[2] - box[0]) * .04, pz = (box[3] - box[1]) * .04; box = [box[0] - px, box[1] - pz, box[2] + px, box[3] + pz]; setView(); }
function setMode(value) { mode = value; $('set-start').classList.toggle('active', mode === 'start'); $('set-end').classList.toggle('active', mode === 'end'); map.classList.toggle('picking', !!mode); }
function drawPins() {
  $('pins').replaceChildren(); $('location').replaceChildren();
  for (const [value, label, color] of [[start, 'A', '#36876d'], [end, 'B', '#c46b59']]) if (value) { element('circle', {cx: value.point[0], cy: value.point[1], r: units * 10, fill: color}, $('pins')); element('text', {x: value.point[0], y: value.point[1], 'font-size': units * 11}, $('pins')).textContent = label; }
  if (coordinate) { const [x, z] = coordinate; element('circle', {cx: x, cy: z, r: units * 4}, $('location')); element('path', {d: `M${x - units * 9} ${z}H${x + units * 9}M${x} ${z - units * 9}V${z + units * 9}`}, $('location')); }
}
function linkForLocation() {
  const url = new URL(location.href); url.hash = ''; for (const key of ['x', 'z', 'span', 'start', 'end']) url.searchParams.delete(key);
  if (coordinate) { url.searchParams.set('x', coordinate[0].toFixed(2)); url.searchParams.set('z', coordinate[1].toFixed(2)); url.searchParams.set('span', (box[2] - box[0]).toFixed(2)); }
  if (start) url.searchParams.set('start', start.point.map(v => v.toFixed(2)).join(','));
  if (end) url.searchParams.set('end', end.point.map(v => v.toFixed(2)).join(','));
  return url.href;
}
function issueDetails() { return `Location: ${coordinateText(coordinate)}\nMap: ${linkForLocation()}\n\nProblem:\n\nExpected road layout:\n`; }
function repositoryURL() { if (data.repository) return data.repository.replace(/\/$/, ''); if (location.hostname.endsWith('.github.io')) { const owner = location.hostname.split('.')[0], first = location.pathname.split('/').filter(Boolean)[0]; const repository = !first || first.endsWith('.html') ? `${owner}.github.io` : first; return `https://github.com/${owner}/${repository}`; } return null; }
function setCoordinate(value) {
  coordinate = validCoordinate(value) ? value : null;
  $('coordinates').textContent = coordinate ? coordinateText(coordinate) : 'Outside the 15,000 × 20,000 map';
  for (const id of ['copy-coordinates', 'copy-link', 'copy-report']) $(id).disabled = !coordinate;
  const repository = repositoryURL(); $('new-issue').hidden = !repository || !coordinate;
  if (repository && coordinate) { const url = new URL(repository + '/issues/new'); url.searchParams.set('title', 'Road issue · ' + coordinateText(coordinate)); url.searchParams.set('body', issueDetails()); $('new-issue').href = url.href; }
  drawPins();
}
async function copy(text, success) {
  try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable'); await navigator.clipboard.writeText(text); notify(success); }
  catch { const field = document.createElement('textarea'); field.value = text; field.style.cssText = 'position:fixed;left:-9999px'; document.body.append(field); field.select(); const copied = document.execCommand('copy'); field.remove(); if (copied) notify(success); else { $('coordinates').textContent = text; notify('Select and copy the text manually.'); } }
}
function calculateRoute() {
  $('start-label').textContent = start ? coordinateText(start.point) : 'Not selected'; $('end-label').textContent = end ? coordinateText(end.point) : 'Not selected';
  $('clear-route').disabled = !start && !end; $('route').replaceChildren(); activeRoute = null;
  if (!start || !end) { $('route-status').textContent = start ? 'Choose a destination on a driving lane.' : 'Click “Set start” to begin.'; return; }
  activeRoute = findRoute(data.nodes, start, end);
  if (!activeRoute) { $('route-status').textContent = 'No connected driving route. Try another lane or location.'; return; }
  const points = routePoints(data.nodes, activeRoute, start, end);
  if (points.length) element('path', {d: svgPath(points), 'data-lane-count': activeRoute.nodes.length}, $('route'));
  $('route-status').textContent = `Route found · ${Math.round(activeRoute.length).toLocaleString('en-US')} map units`;
}
function choose(value) {
  if (!validCoordinate(value)) { setCoordinate(null); notify('This point is outside the map.'); return; }
  setCoordinate(value);
  if (!mode) return;
  const snapped = nearestLane(data.nodes, value);
  if (!snapped) { notify('Click closer to a driving lane.'); return; }
  if (mode === 'start') { start = snapped; setMode(end ? null : 'end'); } else { end = snapped; setMode(null); }
  calculateRoute(); drawPins();
}
function layers() {
  const roads = $('layer-roads').checked;
  for (const id of ['surfaces', 'bands', 'islands', 'marks']) $(id).style.display = roads ? '' : 'none';
  $('background').style.display = $('layer-background').checked ? '' : 'none';
  $('arrows').style.display = roads && $('layer-arrows').checked && units < 1.6 ? '' : 'none';
  $('junction-paths').style.display = roads && $('layer-junctions').checked ? '' : 'none'; $('labels').style.display = $('layer-labels').checked ? '' : 'none';
}
function restoreLocation() {
  const query = new URLSearchParams(location.search), x = Number(query.get('x')), z = Number(query.get('z')), span = Number(query.get('span'));
  if (query.has('x') && query.has('z') && validCoordinate([x, z])) { const width = Number.isFinite(span) && span >= 22 && span <= 20000 ? span : 180; box = [x - width / 2, z - width / 2, x + width / 2, z + width / 2]; setView(); setCoordinate([x, z]); }
  for (const name of ['start', 'end']) if (query.has(name)) { const value = query.get(name).split(',').map(Number); if (validCoordinate(value)) { const lane = nearestLane(data.nodes, value); if (name === 'start') start = lane; else end = lane; } }
  calculateRoute(); drawPins();
}
function render() {
  const b = data.background.bounds; for (const [key, value] of Object.entries({x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1], href: data.background.file})) $('background').setAttribute(key, value);
  for (const surface of data.surfaces) { const d = surface.rings.map(ring => svgPath(ring) + 'Z').join(' '); element('path', {d, fill: COLORS[surface.type] || COLORS.junction, 'fill-rule': 'evenodd'}, $(surface.type === 'green' ? 'islands' : 'surfaces')); }
  for (const band of data.bands) {
    element('path', {d: svgPath(band.polygon) + 'Z', fill: COLORS[band.type] || '#bec7c6', 'data-road': band.road, 'data-lane': band.lane}, $('bands'));
    if (band.mark) element('path', {d: svgPath(band.mark.points), fill: 'none', stroke: band.mark.color === 'yellow' ? '#eadb93' : '#edf0e8', 'stroke-width': band.mark.width, 'stroke-dasharray': band.mark.broken ? '3 5' : 'none'}, $('marks'));
    for (const arrow of band.arrows || []) element('path', {d: svgPath(arrow) + 'Z', fill: '#f7faf7'}, $('arrows'));
  }
  for (const node of data.nodes) if (node.movement) element('path', {d: svgPath(node.points), fill: 'none', stroke: '#dce7e5', 'stroke-width': .13, 'stroke-dasharray': '1 1.7'}, $('junction-paths'));
  for (const road of data.roads) element('text', {x: road.point[0], y: road.point[1], 'text-anchor': 'middle'}, $('labels')).textContent = road.name;
  fit(); layers(); restoreLocation(); $('loading').hidden = true;
}

$('set-start').onclick = () => setMode(mode === 'start' ? null : 'start'); $('set-end').onclick = () => setMode(mode === 'end' ? null : 'end');
$('clear-route').onclick = () => { start = end = null; setMode(null); calculateRoute(); drawPins(); };
$('copy-coordinates').onclick = () => coordinate && copy(coordinateText(coordinate), 'Coordinates copied');
$('copy-link').onclick = () => coordinate && copy(linkForLocation(), 'Map link copied'); $('copy-report').onclick = () => coordinate && copy(issueDetails(), 'Issue details copied');
$('zoom-in').onclick = () => zoom(1 / 1.35); $('zoom-out').onclick = () => zoom(1.35); $('fit').onclick = fit;
for (const id of ['layer-roads', 'layer-background', 'layer-arrows', 'layer-junctions', 'layer-labels']) $(id).onchange = layers;
const compareGroups = ['surfaces', 'bands', 'islands', 'marks', 'arrows', 'junction-paths', 'labels', 'route', 'pins', 'location'];
$('compare').onpointerdown = () => compareGroups.forEach(id => $(id).style.visibility = 'hidden');
window.addEventListener('pointerup', () => compareGroups.forEach(id => $(id).style.visibility = ''));
map.addEventListener('wheel', event => { if (!data) return; event.preventDefault(); zoom(event.deltaY > 0 ? 1.13 : 1 / 1.13, point(event)); layers(); }, {passive: false});
map.addEventListener('pointerdown', event => { if (!data || event.button !== 0) return; gesture = {client: [event.clientX, event.clientY], point: point(event), matrix: map.getScreenCTM().inverse(), box: box.slice(), moved: false}; map.setPointerCapture(event.pointerId); });
map.addEventListener('pointermove', event => { if (!gesture) return; if (Math.hypot(event.clientX - gesture.client[0], event.clientY - gesture.client[1]) > 5) gesture.moved = true; if (!gesture.moved) return; const p = point(event, gesture.matrix), dx = gesture.point[0] - p[0], dz = gesture.point[1] - p[1]; box = gesture.box.map((v, i) => v + (i % 2 ? dz : dx)); map.classList.add('panning'); setView(); });
map.addEventListener('pointerup', event => { if (!gesture) return; const moved = gesture.moved; gesture = null; map.classList.remove('panning'); if (!moved) choose(point(event)); });
map.addEventListener('pointercancel', () => { gesture = null; map.classList.remove('panning'); });
window.addEventListener('resize', () => data && setView());
window.addEventListener('keydown', event => { if (event.key === 'Escape') setMode(null); });

try { const response = await fetch('map-data.json'); if (!response.ok) throw new Error(`Map request failed (${response.status})`); data = await response.json(); render(); window.ViceBeachMap = {data, get view() { return box; }, get state() { return {mode, coordinate, start, end, route: activeRoute}; }}; }
catch (error) { console.error(error); $('loading').replaceChildren(Object.assign(document.createElement('p'), {textContent: 'The map could not be loaded. Please refresh the page.'})); }

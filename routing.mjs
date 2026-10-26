export const MAP_SIZE = [15000, 20000];

export function validCoordinate(point) {
  return Array.isArray(point) && point.length === 2 && point.every((v, i) => Number.isFinite(v) && v >= 0 && v < MAP_SIZE[i]);
}

export function coordinateText(point) {
  if (!validCoordinate(point)) throw new Error('Point is outside the map');
  const [x, z] = point.map((v, i) => Math.min(MAP_SIZE[i] - 1, Math.round(v)));
  return `X: ${x}, Z: ${z}`;
}

export function lineLength(points) {
  return points.slice(1).reduce((total, p, i) => total + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
}

export function nearestLane(nodes, point, limit = 14) {
  let best = null;
  nodes.forEach((node, index) => {
    let before = 0;
    for (let i = 1; i < node.points.length; i++) {
      const a = node.points[i - 1], b = node.points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (!length) continue;
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length ** 2));
      const xy = [a[0] + dx * t, a[1] + dz * t], distance = Math.hypot(point[0] - xy[0], point[1] - xy[1]);
      if (distance <= limit && (!best || distance < best.distance - 1e-9)) best = {node: index, along: before + t * length, point: xy, distance};
      before += length;
    }
  });
  return best;
}

class Heap {
  values = [];
  push(item) {
    const a = this.values; a.push(item); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= item[0]) break; a[i] = a[p]; i = p; } a[i] = item;
  }
  pop() {
    const a = this.values, first = a[0], last = a.pop();
    if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let j = i * 2 + 1; if (j + 1 < a.length && a[j + 1][0] < a[j][0]) j++; if (a[j][0] >= last[0]) break; a[i] = a[j]; i = j; } a[i] = last; }
    return first;
  }
}

function routeOnLanes(nodes, start, end) {
  if (!start || !end) return null;
  if (start.node === end.node && end.along >= start.along) return {nodes: [start.node], length: end.along - start.along};
  const distances = new Float64Array(nodes.length).fill(Infinity), previous = new Int32Array(nodes.length).fill(-1), heap = new Heap();
  for (const next of nodes[start.node].next) { const distance = nodes[start.node].length - start.along; if (distance < distances[next]) { distances[next] = distance; heap.push([distance, next]); } }
  while (heap.values.length) {
    const [distance, index] = heap.pop(); if (distance !== distances[index]) continue;
    if (index === end.node) { const path = []; let current = index; while (current !== -1) { path.push(current); current = previous[current]; } path.reverse(); return {nodes: [start.node, ...path], length: distance + end.along}; }
    for (const next of nodes[index].next) { const candidate = distance + nodes[index].length; if (candidate < distances[next]) { distances[next] = candidate; previous[next] = index; heap.push([candidate, next]); } }
  }
  return null;
}

export function findRoute(nodes, start, end) {
  if (!start || !end) return null;
  const choices = endpoint => {
    const reverse = nodes[endpoint.node].reverse;
    return reverse === undefined ? [endpoint] : [endpoint, {...endpoint, node: reverse, along: nodes[reverse].length - endpoint.along}];
  };
  let best = null;
  for (const from of choices(start)) for (const to of choices(end)) {
    const candidate = routeOnLanes(nodes, from, to);
    if (candidate && (!best || candidate.length < best.length)) {
      best = candidate;
      if (from !== start || to !== end) best = {...candidate, startAlong: from.along, endAlong: to.along};
    }
  }
  return best;
}

function clippedLine(points, from, to) {
  const output = []; let before = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length && before + length >= from && before <= to) {
      const position = s => a.map((v, axis) => v + (b[axis] - v) * Math.max(0, Math.min(1, (s - before) / length)));
      const p = position(from), q = position(to);
      if (!output.length || Math.hypot(output.at(-1)[0] - p[0], output.at(-1)[1] - p[1]) > 1e-8) output.push(p);
      output.push(q);
    }
    before += length;
  }
  return output;
}

export function routePoints(nodes, route, start, end) {
  if (!route) return [];
  return route.nodes.flatMap((index, i) => clippedLine(nodes[index].points, i === 0 ? (route.startAlong ?? start.along) : 0, i === route.nodes.length - 1 ? (route.endAlong ?? end.along) : nodes[index].length));
}

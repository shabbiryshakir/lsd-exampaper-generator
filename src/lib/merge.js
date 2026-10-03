// Three-way merge used when two teachers edit the same paper.
// base = the version both started from, local = this device, remote = the latest in the cloud.
// Whatever one side changed wins over the side that left it alone; if both changed the same
// question, this device's version is kept (the other teacher sees it on their next sync).
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mergeFields = (base = {}, local = {}, remote = {}, special = {}) => {
  const out = {};
  new Set([...Object.keys(local), ...Object.keys(remote)]).forEach(k => {
    if (special[k]) { out[k] = special[k](base[k], local[k], remote[k]); return; }
    out[k] = same(local[k], base[k]) ? remote[k] : local[k];
    if (out[k] === undefined) delete out[k];
  });
  // A field one side deleted and the other left alone stays deleted.
  Object.keys(out).forEach(k => { if (!(k in local) && same(remote[k], base[k])) delete out[k]; if (!(k in remote) && same(local[k], base[k])) delete out[k]; });
  return out;
};

// Merges two lists of objects that carry ids (subjects, questions).
export function mergeList(base = [], local = [], remote = [], mergeItem = (b, l) => l) {
  const ids = (list) => list.map(x => x.id);
  const B = new Map(base.map(x => [x.id, x])), L = new Map(local.map(x => [x.id, x])), R = new Map(remote.map(x => [x.id, x]));
  // Order: if only this device reordered, keep its order; otherwise follow the cloud.
  const localReordered = !same(ids(local).filter(id => B.has(id)), ids(base).filter(id => L.has(id)));
  const remoteReordered = !same(ids(remote).filter(id => B.has(id)), ids(base).filter(id => R.has(id)));
  const order = localReordered && !remoteReordered ? ids(local) : ids(remote);
  // Items added on this device go in after the item they followed.
  ids(local).forEach((id, i) => {
    if (order.includes(id)) return;
    const before = ids(local).slice(0, i).reverse().find(x => order.includes(x));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  ids(remote).forEach(id => { if (!order.includes(id)) order.push(id); });

  const out = [];
  order.forEach(id => {
    const b = B.get(id), l = L.get(id), r = R.get(id);
    if (!b) { out.push(l || r); return; }                        // new on one side
    if (!l) { if (r && !same(r, b)) out.push(r); return; }       // deleted here (kept if edited there)
    if (!r) { if (!same(l, b)) out.push(l); return; }            // deleted there (kept if edited here)
    out.push(mergeItem(b, l, r));
  });
  return out;
}

const mergeQuestion = (b, l, r) => (same(l, b) ? r : l);
const mergeSubject = (b, l, r) => mergeFields(b, l, r, { questions: (bq, lq, rq) => mergeList(bq || [], lq || [], rq || [], mergeQuestion) });

export function mergePaper(base, local, remote) {
  if (!base) return local;
  return {
    header: mergeFields(base.header, local.header, remote.header),
    layout: mergeFields(base.layout, local.layout, remote.layout),
    subjects: mergeList(base.subjects || [], local.subjects || [], remote.subjects || [], mergeSubject),
  };
}

var test = require('tape')
var hyperlog = require('hyperlog')
var fdstore = require('fd-chunk-store')
var path = require('path')
var memdb = require('memdb')

var tmpdir = require('os').tmpdir()

var osmdb = require('../')

test('update node', function (t) {
  t.plan(9)

  var storefile = path.join(tmpdir, 'osm-store-' + Math.random())
  var osm = osmdb({
    log: hyperlog(memdb(), { valueEncoding: 'json' }),
    db: memdb(),
    store: fdstore(4096, storefile)
  })

  var docs = {
    A: { type: 'node', lat: 64.5, lon: -147.3 },
    B: { type: 'node', lat: 63.9, lon: -147.6 },
    C: { type: 'node', lat: 64.2, lon: -146.5 },
    D: { type: 'way', refs: [ 'A', 'B', 'C' ] }
  }
  var names = {}
  var nodes = {}
  var versions = {}

  var keys = Object.keys(docs).sort()
  ;(function next () {
    if (keys.length === 0) return ready()
    var key = keys.shift()
    var doc = docs[key]
    if (doc.refs) {
      doc.refs = doc.refs.map(function (ref) { return names[ref] })
    }
    osm.create(doc, function (err, k, node) {
      t.ifError(err)
      names[key] = k
      versions[key] = node.key
      nodes[k] = node
      next()
    })
  })()

  function ready () {
    var newdoc = { type: 'node', lat: 62.5, lon: -146.2 }
    osm.put(names.C, newdoc, function (err, node) {
      t.ifError(err)
      versions.C = node.key
      check()
    })
  }

  function check () {
    var q0 = [[63,65],[-148,-146]]
    var ex0 = [
      { type: 'node', lat: 64.5, lon: -147.3,
        id: names.A, version: versions.A },
      { type: 'node', lat: 63.9, lon: -147.6,
        id: names.B, version: versions.B },
      { type: 'node', lat: 62.5, lon: -146.2,
        id: names.C, version: versions.C },
      { type: 'way', refs: [ names.A, names.B, names.C ],
        id: names.D, version: versions.D }
    ].sort(idcmp)
    osm.query(q0, function (err, res) {
      t.ifError(err)
      t.deepEqual(res.sort(idcmp), ex0, 'updated query 0')
    })
    var q1 = [[62,64],[-149.5,-146]]
    var ex1 = [
      { type: 'node', lat: 64.5, lon: -147.3,
        id: names.A, version: versions.A },
      { type: 'node', lat: 63.9, lon: -147.6,
        id: names.B, version: versions.B },
      { type: 'node', lat: 62.5, lon: -146.2,
        id: names.C, version: versions.C },
      { type: 'way', refs: [ names.A, names.B, names.C ],
        id: names.D, version: versions.D }
    ].sort(idcmp)
    osm.query(q1, function (err, res) {
      t.ifError(err)
      t.deepEqual(res.sort(idcmp), ex1, 'updated query 1')
    })
  }
})

function idcmp (a, b) {
  return a.id < b.id ? -1 : 1
}

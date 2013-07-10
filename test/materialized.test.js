var util = require('util')
  , assert = require('assert')
  , should = require('should')
  , db = require('mongoose')
  , materialized = require('../lib/materialized')
  , Schema = db.Schema
  , ObjectId = Schema.ObjectId

db.connect(process.env.MONGO_DB_URI || 'mongodb://localhost/mongoose-materialized')

describe('Matarialized test', function() {

  // schema
    var treeSchema = new Schema({ name: 'string', count: 'number' })
    treeSchema.plugin(materialized)
    var TreeModel = db.model('tree', treeSchema, 'tree')

    var RootId = null,
        lvl1Id = null,
        lvl2Id = null

  describe('#insert', function() {

    it('should insert main element, without parentId', function (done) {
      var instance = new TreeModel({ name: 'Main element', count: 0, parentId: null })
      instance.save(function(err, doc) {
        RootId = doc._id
        assert.strictEqual(err, null)
        assert.strictEqual(doc.path, "")
        assert.strictEqual(doc.parentId, null)
        assert.strictEqual(doc.depth, 0)
        done()
      })
    })

    it('should insert 1 level 1st child element', function (done) {
      var instance = new TreeModel({ name: 'child element', count: 1, parentId: RootId })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 1)
        assert.strictEqual(doc.parentId, RootId)
        assert.strictEqual(doc.path, ','+ RootId)
        assert.strictEqual(doc.depth, 1)
        lvl1Id = doc._id
        done()
      })
    })

    it('should insert 1 level 2nd child element', function (done) {
      var instance = new TreeModel({ name: 'child element', count: 5, parentId: RootId })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 5)
        assert.strictEqual(doc.parentId, RootId)
        assert.strictEqual(doc.path, ','+ RootId)
        assert.strictEqual(doc.depth, 1)
        done()
      })
    })

    it('should insert 2 level 1st child element', function (done) {
      var instance = new TreeModel({ name: 'child element', count: 3, parentId: lvl1Id })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 3)
        assert.strictEqual(doc.parentId, lvl1Id)
        assert.strictEqual(doc.path, ','+ RootId +','+ lvl1Id)
        assert.strictEqual(doc.depth, 2);
        done()
      })
    })

    it('should insert 2 level 2nd child element', function (done) {
      var instance = new TreeModel({ name: 'child element', count: 2, parentId: lvl1Id })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 2)
        assert.strictEqual(doc.parentId, lvl1Id)
        assert.strictEqual(doc.path, ','+ RootId +','+ lvl1Id)
        assert.strictEqual(doc.depth, 2)
        lvl2Id = doc._id
        done()
      })
    })

    it('sholud insert element for non exsitsing parent', function(done) {
      var instance = new TreeModel({ name: 'child element without parent', count: 6, parentId: db.Types.ObjectId() })
      instance.save(function(err, doc) {
        assert.notEqual(err, null)
        done()
      })
    })

  })

  describe('#query', function(){

    it('should query root data', function(done){
      TreeModel.findOne({parentId: null}).exec(function(err, doc){
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 0)
        assert.strictEqual(doc._id.toString(), RootId.toString())
        assert.strictEqual(doc.depth, 0)
        done()
      });
    })

    it('should query getParent ', function(done){
      TreeModel.findById(lvl2Id).exec(function(err, doc){
        assert.strictEqual(err, null)
        doc.getParent(function(err, doc2){
          assert.strictEqual(err, null)
          assert.strictEqual(doc2._id.toString(), doc.parentId.toString())
          done()
        })
      })
    })

    it('should query getDescendants', function(done){
      TreeModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants(function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 4)
          assert.strictEqual(docs[0].parentId.toString(), rdoc._id.toString())
          done()
        })
      })
    })

    it('should query sub getDescendants', function(done){
      TreeModel.findOne({_id: lvl1Id}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants(function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 2)
          assert.strictEqual(docs[0].parentId.toString(), rdoc._id.toString())
          done()
        })
      })
    })

    it('should query getAncestors', function(done){
        TreeModel.findById({_id: lvl2Id}).exec(function(err, doc){
          assert.strictEqual(err, null)
          doc.getAncestors(function(err, parents){
            assert.strictEqual(err, null)
            assert.strictEqual(parents.length, 2)
            done()
          })
        })
    })

  })

  describe('#clean', function(){

    it('should drop database', function(done){
      db.connection.db.executeDbCommand({
        dropDatabase: 1
      }, function(err, result) {
        assert.strictEqual(err, null)
        done()
      })
    })

  })

  after(function(done){
      db.disconnect()
      done()
  });

})
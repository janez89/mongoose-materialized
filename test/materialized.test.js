var util = require('util')
  , assert = require('assert')
  , should = require('should')
  , async = require('async')
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
        lvl1Id2= null,
        lvl2Id = null

  describe('#insert', function() {

    it('should insert main element, without parentId', function (done) {
      var instance = new TreeModel({ name: '#0, parent: null, lvl: 0', count: 0, parentId: null })
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
      var instance = new TreeModel({ name: '#1, parent: #0, lvl: 1', count: 1, parentId: RootId })
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
      var instance = new TreeModel({ name: '#2, parent: #0, lvl: 1', count: 5, parentId: RootId })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.count, 5)
        assert.strictEqual(doc.parentId, RootId)
        assert.strictEqual(doc.path, ','+ RootId)
        assert.strictEqual(doc.depth, 1)
        lvl1Id2 = doc._id;
        done()
      })
    })

    it('should insert 2 level 1st child element', function (done) {
      var instance = new TreeModel({ name: '#3, parent: #1, lvl: 2', count: 3, parentId: lvl1Id })
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
      var instance = new TreeModel({ name: '#4, parent: #1, lvl: 2', count: 2, parentId: lvl1Id })
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

    it('should query getDescendants with pagination', function(done){
      TreeModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants({limit: 2, skip: 1},function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 2)
          assert.strictEqual(docs[0].parentId.toString(), rdoc._id.toString())
          done()
        })
      })
    })

    it('should query getChildren with promise', function(done){
      TreeModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getChildren().then(function(docs){
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

    it('should get children static', function (done) {
        TreeModel.GetChildren(RootId, function (err, children) {
            assert.strictEqual(err, null)
            assert.strictEqual(children.length, 4)
            done()
        });
    })

    it('should get children static with condition', function (done) {
        TreeModel.GetChildren(RootId, {
            condition: { count: 1 }
        }, function (err, children) {
            assert.strictEqual(err, null)
            assert.strictEqual(children.length, 1)
            assert.strictEqual(children[0].count, 1)
            done()
        });
    })

    it('should get roots', function (done) {
        TreeModel.GetRoots(function (err, roots) {
            assert.strictEqual(err, null)
            assert.strictEqual(roots.length, 1)
            assert.strictEqual(roots[0].parentId, null)
            done()
        });
    })

    it('should get tree', function (done) {
        TreeModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getChildren(function (err, childs) {
                assert.strictEqual(err, null)
                assert.notStrictEqual(childs.length, 0)

                var tree = TreeModel.ToTree(childs)
                assert.strictEqual(Object.keys(tree).length, 2)
                for(var i in tree){
                    if (tree[i].name === '#1, parent: #0, lvl: 1') {
                        assert.strictEqual(Object.keys(tree[i].children).length, 2)
                    }
                }
                done()
            })
        })
    })

    it('should get tree, respect sorting (_w)', function (done) {
      var data = {};
      async.waterfall([
        function(cb) {
          TreeModel.create({ name: 'A' }, function(err, catA) {
            data.catA = catA;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A1', _w: 3 }, function(err, catA1) {
            data.catA1 = catA1;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A2', _w: 2 }, function(err, catA2) {
            data.catA2 = catA2;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A3', _w: 1 }, function(err, catA3) {
            data.catA3 = catA3;
            cb(err);
          });
        },
      ], function (err, results) {
          TreeModel.findOne({ _id: data.catA._id }, function(err, root) {
            assert.strictEqual(err, null);
            root.getTree(function (err, tree) {
              const keysList = Object.keys(tree[data.catA._id].children);
              assert.strictEqual(keysList[0], data.catA3._id.toString());
              assert.strictEqual(keysList[1], data.catA2._id.toString());
              assert.strictEqual(keysList[2], data.catA1._id.toString());
              done()
            })
        })
      });
    });

    it('should get array tree', function (done) {
        TreeModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getChildren(function (err, childs) {
                assert.strictEqual(err, null)
                assert.notStrictEqual(childs.length, 0)

                var tree = TreeModel.ToArrayTree(childs)
                assert.strictEqual(tree.length, 2)
                for(var i in tree){
                    if (tree[i].name === '#1, parent: #0, lvl: 1') {
                        assert.strictEqual(tree[i].children.length, 2)
                    }
                }
                done()
            })
        })
    })

    it('should get array tree, respect sorting (_w)', function (done) {
      var data = {};
      async.waterfall([
        function(cb) {
          TreeModel.create({ name: 'A' }, function(err, catA) {
            data.catA = catA;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A1', _w: 3 }, function(err, catA1) {
            data.catA1 = catA1;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A2', _w: 2 }, function(err, catA2) {
            data.catA2 = catA2;
            cb(err, catA);
          });
        },
        function(catA, cb) {
          TreeModel.create({ parentId: catA._id, name: 'A3', _w: 1 }, function(err, catA3) {
            data.catA3 = catA3;
            cb(err);
          });
        },
      ], function (err, results) {
          TreeModel.findOne({ _id: data.catA._id }, function(err, root) {
            assert.strictEqual(err, null);
            root.getArrayTree(function (err, tree) {
              assert.strictEqual(tree[0].children[0].name, 'A3');
              assert.strictEqual(tree[0].children[1].name, 'A2');
              assert.strictEqual(tree[0].children[2].name, 'A1');
              done()
            })
        })
      });
    });

    it('should get tree with root', function (done) {
        TreeModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getTree(function (err, tree) {
                assert.strictEqual(err, null)
                assert.strictEqual(tree[root._id.toString()].name, root.name)
                assert.strictEqual(tree[root._id.toString()].parentId, null)
                var childKeys = Object.keys(tree[root._id.toString()].children)
                assert.strictEqual(childKeys.length, 2)
                assert.strictEqual(tree[root._id.toString()].children[lvl1Id]._id.toString(), lvl1Id.toString()) // 1st child
                assert.strictEqual(tree[root._id.toString()].children[lvl1Id2]._id.toString(), lvl1Id2.toString()) // 2nd child
                done()
            })
        })
    })

    it('should get array tree with root', function (done) {
        TreeModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getArrayTree(function (err, tree) {
                assert.strictEqual(err, null)
                assert.strictEqual(tree[0].name, root.name)
                assert.strictEqual(tree[0].parentId, null)

                assert.strictEqual(tree[0].children.length, 2)
                assert.strictEqual(tree[0].children[0]._id.toString(), lvl1Id.toString()) // 1st child
                assert.strictEqual(tree[0].children[1]._id.toString(), lvl1Id2.toString()) // 2nd child
                done()
            })
        })
    })

    it('should get tree with root static', function (done) {
        TreeModel.GetTree({parentId: null}, function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[RootId.toString()].parentId, null)
            var childKeys = Object.keys(tree[RootId.toString()].children)
            assert.strictEqual(childKeys.length, 2)
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id]._id.toString(), lvl1Id.toString()) // 1st child
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id2]._id.toString(), lvl1Id2.toString()) // 2nd child
            done()
        })
    })

    it('should get array tree with root static', function (done) {
        TreeModel.GetArrayTree({parentId: null}, function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[0].parentId, null)
            assert.strictEqual(tree[0].children.length, 2)

            for(var i in tree[0].children) {
              assert.strictEqual(tree[0].children[i].parentId.toString(), tree[0]._id.toString());
            }
            done()
        })
    })

    it('should get full tree', function (done) {
        TreeModel.GetFullTree(function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[RootId.toString()].parentId, null)
            var childKeys = Object.keys(tree[RootId.toString()].children)
            assert.strictEqual(childKeys.length, 2)
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id]._id.toString(), lvl1Id.toString()) // 1st child
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id2]._id.toString(), lvl1Id2.toString()) // 2nd child
            done()
        })
    })

    it('should get full array tree', function (done) {
        TreeModel.GetFullArrayTree(function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[0].parentId, null)
            assert.strictEqual(tree[0].children.length, 2)

            for(var i in tree[0].children) {
              assert.strictEqual(tree[0].children[i].parentId.toString(), tree[0]._id.toString());
            }
            done()
        })
    })

  })

  describe('#building', function () {
      var simpleSchema = new Schema({
          name: 'string',
          parentId: 'ObjectId'
      })
      var Simple = db.model('simple', simpleSchema, 'simple')

      var main = new Simple({name: "#0", parentId: null })
      it('should populate collection for building', function (done) {
          main.save(function (err, root) {
              var child1 = new Simple({name: "#1", parentId: root._id })
              child1.save(function (err1, ch1) {
                  var child2 = new Simple({name: "#2", parentId: ch1._id })
                  child2.save(function (err2, ch2) {
                      var child3 = new Simple({name: "#3", parentId: ch1._id })
                      child3.save(function(err3, ch3) {
                          done()
                      })
                  })
              })
          })
      })

      var simple1Schema = new Schema({
          name: 'string',
          parentId: 'ObjectId'
      })
      simple1Schema.plugin(materialized)
      var Simple1 = db.model('simple1', simple1Schema, 'simple')
      it('should building hierarchic and check tree', function (done) {
          Simple1.Building(function (){
              Simple1.findOne({parentId: null}).exec(function (err, root) {
                  assert.strictEqual(err, null)
                  Simple1.findOne({parentId: root._id}).exec(function (err, doc) {
                      assert.strictEqual(err, null)
                      assert.strictEqual(doc.path, ','+ root._id)
                      doc.getChildren(function (err, children) {
                        assert.strictEqual(err, null)
                        assert.strictEqual(children.length, 2)
                        assert.strictEqual(children[0].path, doc.path +','+ doc._id.toString() )
                        done()
                      })
                  })
              })
          })
      })
  })

  describe('#tree-moving', function () {
      var catSchema = new Schema({
          name: 'string'
      })
      catSchema.plugin(materialized);
      var Cat = db.model('cat2', catSchema, 'cat2')

      var foodId = null,
          vegaId = null,
          tomatoId = null,
          pepperId = null;

      // ---------------------------------------------------------

      it('sholud build simple category schema', function (done) {
        var food = new Cat({name: "Foods"});
        food.save(function (err, food) {
          assert.strictEqual(err, null);
          foodId = food._id;

          food.appendChild({"name":"Vegetables"}, function (err, vega) {
            assert.strictEqual(err, null);
            vegaId = vega._id;

            var tomato = new Cat({"name": "Tomato"});
            tomato.parentId = vegaId;
            tomato.save(function (err, tomato) {
              assert.strictEqual(err, null);
              tomatoId = tomato._id;
              vega.appendChild({name: "pepper"}, function (err, pepper) {
                pepperId = pepper._id;
                done();
              });
            });

          });

        });
      });

      it('sholud remove item parent', function (done) {
        Cat.findById(vegaId, function (err, vega) {
          vega.parentId = null;
          vega.save(function (err, vega) {
            assert.strictEqual(err, null);

            Cat.findById(tomatoId, function (err, tomato) {
              assert.strictEqual(tomato.path, ','+ vega._id.toString());

              Cat.findById(pepperId, function (err, pepper) {
                assert.strictEqual(pepper.path, ','+ vega._id.toString());
                done();
              });
            });
          });
        });
      });

      it('sholud move root item to sub element', function (done) {
        Cat.findById(vegaId, function (err, vega) {
          vega.parentId = foodId;
          vega.save(function (err, vega) {
            assert.strictEqual(err, null);
            assert.strictEqual(vega.parentId, foodId);

            Cat.findById(tomatoId, function (err, tomato) {
              assert.strictEqual(tomato.path, vega.path + ','+ vega._id.toString());

              Cat.findById(pepperId, function (err, pepper) {
                assert.strictEqual(pepper.path, vega.path + ','+ vega._id.toString());
                done();
              });
            });
          });
        });
      });

      it('should move item with all children', function (done) {
        var data = {};
        async.waterfall([
          function(cb) {
            TreeModel.create({ name: 'A' }, function(err, catA) {
              data.catA = catA;
              cb(err, catA);
            });
          },
          function(catA, cb) {
            TreeModel.create({ parentId: catA._id, name: 'A1', _w: 3 }, function(err, catA1) {
              data.catA1 = catA1;
              cb(err, catA1);
            });
          },
          function(catA1, cb) {
            TreeModel.create({ parentId: catA1._id, name: 'A2', _w: 2 }, function(err, catA2) {
              data.catA2 = catA2;
              cb(err, catA2);
            });
          },
          function(catA2, cb) {
            TreeModel.create({ parentId: catA2._id, name: 'A3', _w: 1 }, function(err, catA3) {
              data.catA3 = catA3;
              cb(err);
            });
          },
          function(cb) {
            TreeModel.create({ parentId: data.catA1._id, name: 'A2a' }, function(err, catA2a) {
              data.catA2a = catA2a;
              cb(err);
            });
          },
          function(cb) {
            TreeModel.create({ name: 'B' }, function(err, catB) {
              data.catB = catB;
              cb(err, data);
            });
          },
        ], function (err, results) {
          // move catA1 to B and check catA3
          data.catA1.parentId = data.catB._id;
          data.catA1.save(function(err, catA1) {
            assert.strictEqual(catA1.parentId, data.catB._id);
            async.parallel({
              catA2: function(cb) {
                TreeModel.findById(data.catA2._id, function(err, catA2) {
                  cb(err, catA2);
                });
              },
              catA2a: function(cb) {
                TreeModel.findById(data.catA2a._id, function(err, catA2a) {
                  cb(err, catA2a);
                });
              },
              catA3: function(cb) {
                TreeModel.findById(data.catA3._id, function(err, catA3) {
                  cb(err, catA3);
                });
              }
            }, function(err, getResults) {
              assert.strictEqual(getResults.catA2.path, ','+data.catB._id+','+data.catA1._id);
              assert.strictEqual(getResults.catA2a.path, ','+data.catB._id+','+data.catA1._id);
              assert.strictEqual(getResults.catA3.path, ','+data.catB._id+','+data.catA1._id+','+data.catA2._id);
              done();
            });
          });
        });
      });
  });

  describe('#clean', function () {

    it('sholud remove #1 item', function (done) {
        TreeModel.findById(lvl1Id, function(err, doc){
            assert.equal(err, null)
            TreeModel.Remove({_id: lvl1Id}, function (err) {
                assert.equal(err, null)
                TreeModel.findOne({parentId: lvl1Id}).exec(function (err, child) {
                  assert.strictEqual(err, null)
                  assert.strictEqual(child, null)
                  done()
                })
            })
        })
    })

    it('should drop database', function(done){
      db.connection.db.executeDbCommand({
        dropDatabase: 1
      }, function(err, result) {
        assert.strictEqual(err, null)
        done()
      })
    })

  })

})


describe('Alternative tests', function() {

  var novaSchema = new Schema({ id: 'number', name: 'string' });
  novaSchema.plugin(materialized, {field: 'id'});
  var NovaModel = db.model('nova', novaSchema, 'nova');

  var RootId = null,
      lvl1Id = null,
      lvl1Id2= null,
      lvl2Id = null;

  describe('#insert', function() {

    it('should insert main element, without parentId', function (done) {
      var instance = new NovaModel({ id: 1, name: '#0, parent: null, lvl: 0', parentId: null })
      instance.save(function(err, doc) {
        RootId = doc.id
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id, 1)
        assert.strictEqual(doc.path, "")
        assert.strictEqual(doc.parentId, null)
        assert.strictEqual(doc.depth, 0)
        done()
      })
    })

    it('should insert 1 level 1st child element', function (done) {
      var instance = new NovaModel({ id: 2, name: '#1, parent: #0, lvl: 1', parentId: RootId })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id, 2)
        assert.strictEqual(doc.parentId, RootId)
        assert.strictEqual(doc.path, ','+ RootId)
        assert.strictEqual(doc.depth, 1)
        lvl1Id = doc.id
        done()
      })
    })

    it('should insert 1 level 2nd child element', function (done) {
      var instance = new NovaModel({ id: 3, name: '#2, parent: #0, lvl: 1', parentId: RootId })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id, 3)
        assert.strictEqual(doc.parentId, RootId)
        assert.strictEqual(doc.path, ','+ RootId)
        assert.strictEqual(doc.depth, 1)
        lvl1Id2 = doc.id;
        done()
      })
    })

    it('should insert 2 level 1st child element', function (done) {
      var instance = new NovaModel({ id: 4, name: '#3, parent: #1, lvl: 2', parentId: lvl1Id })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id, 4)
        assert.strictEqual(doc.parentId, lvl1Id)
        assert.strictEqual(doc.path, ','+ RootId +','+ lvl1Id)
        assert.strictEqual(doc.depth, 2);
        done()
      })
    })

    it('should insert 2 level 2nd child element', function (done) {
      var instance = new NovaModel({ id: 5, name: '#4, parent: #1, lvl: 2', parentId: lvl1Id })
      instance.save(function(err, doc) {
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id, 5)
        assert.strictEqual(doc.parentId, lvl1Id)
        assert.strictEqual(doc.path, ','+ RootId +','+ lvl1Id)
        assert.strictEqual(doc.depth, 2)
        lvl2Id = doc.id
        done()
      })
    })

    it('sholud insert element for non exsitsing parent', function(done) {
      var instance = new NovaModel({ id: 6, name: 'child element without parent', parentId: db.Types.ObjectId() })
      instance.save(function(err, doc) {
        assert.notEqual(err, null)
        done()
      })
    })

  })

  describe('#query', function(){

    it('should query root data', function(done){
      NovaModel.findOne({parentId: null}).exec(function(err, doc){
        assert.strictEqual(err, null)
        assert.strictEqual(doc.id.toString(), RootId.toString())
        assert.strictEqual(doc.depth, 0)
        done()
      });
    })

    it('should query getParent ', function(done){
      NovaModel.findOne({id: lvl2Id}).exec(function(err, doc){
        assert.strictEqual(err, null)
        doc.getParent(function(err, doc2){
          assert.strictEqual(err, null)
          assert.strictEqual(doc2.id.toString(), doc.parentId.toString())
          done()
        })
      })
    })

    it('should query getDescendants', function(done){
      NovaModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants(function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 4)
          assert.strictEqual(docs[0].parentId.toString(), rdoc.id.toString())
          done()
        })
      })
    })

    it('should query getDescendants with pagination', function(done){
      NovaModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants({limit: 2, skip: 1},function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 2)
          assert.strictEqual(docs[0].parentId.toString(), rdoc.id.toString())
          done()
        })
      })
    })

    it('should query getChildren with promise', function(done){
      NovaModel.findOne({parentId: null}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getChildren().then(function(docs){
          assert.strictEqual(docs.length, 4)
          assert.strictEqual(docs[0].parentId.toString(), rdoc.id.toString())
          done()
        })
      })
    })

    it('should query sub getDescendants', function(done){
      NovaModel.findOne({id: lvl1Id}).exec(function(err, rdoc){
        assert.equal(err, null)
        rdoc.getDescendants(function(err, docs){
          assert.strictEqual(err, null)
          assert.strictEqual(docs.length, 2)
          assert.strictEqual(docs[0].parentId.toString(), rdoc.id.toString())
          done()
        })
      })
    })

    it('should query getAncestors', function(done){
      NovaModel.findOne({id: lvl2Id}).exec(function(err, doc){
          assert.strictEqual(err, null)
          doc.getAncestors(function(err, parents){
            assert.strictEqual(err, null)
            assert.strictEqual(parents.length, 2)
            done()
          })
        })
    })

    it('should get children static', function (done) {
      NovaModel.GetChildren(RootId, function (err, children) {
            assert.strictEqual(err, null)
            assert.strictEqual(children.length, 4)
            done()
        });
    })

    it('should get children static with condition', function (done) {
      NovaModel.GetChildren(RootId, {
            condition: { id: 4 }
        }, function (err, children) {
            assert.strictEqual(err, null)
            assert.strictEqual(children.length, 1)
            assert.strictEqual(children[0].name, '#3, parent: #1, lvl: 2')
            done()
        });
    })

    it('should get roots', function (done) {
      NovaModel.GetRoots(function (err, roots) {
            assert.strictEqual(err, null)
            assert.strictEqual(roots.length, 1)
            assert.strictEqual(roots[0].parentId, null)
            done()
        });
    })

    it('should get tree', function (done) {
      NovaModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getChildren(function (err, childs) {
                assert.strictEqual(err, null)
                assert.notStrictEqual(childs.length, 0)

                var tree = NovaModel.ToTree(childs)
                assert.strictEqual(Object.keys(tree).length, 2)
                for(var i in tree){
                    if (tree[i].name === '#1, parent: #0, lvl: 1') {
                        assert.strictEqual(Object.keys(tree[i].children).length, 2)
                    }
                }
                done()
            })
        })
    })

    it('should get array tree', function (done) {
      NovaModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getChildren(function (err, childs) {
                assert.strictEqual(err, null)
                assert.notStrictEqual(childs.length, 0)

                var tree = NovaModel.ToArrayTree(childs)
                assert.strictEqual(tree.length, 2)
                for(var i in tree){
                    if (tree[i].name === '#1, parent: #0, lvl: 1') {
                        assert.strictEqual(tree[i].children.length, 2)
                    }
                }
                done()
            })
        })
    })

    it('should get tree with root', function (done) {
      NovaModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getTree(function (err, tree) {
                assert.strictEqual(err, null)
                assert.strictEqual(tree[root.id.toString()].name, root.name)
                assert.strictEqual(tree[root.id.toString()].parentId, null)
                var childKeys = Object.keys(tree[root.id.toString()].children)
                assert.strictEqual(childKeys.length, 2)
                assert.strictEqual(tree[root.id.toString()].children[lvl1Id].id.toString(), lvl1Id.toString()) // 1st child
                assert.strictEqual(tree[root.id.toString()].children[lvl1Id2].id.toString(), lvl1Id2.toString()) // 2nd child
                done()
            })
        })
    })

    it('should get array tree with root', function (done) {
      NovaModel.findOne({ parentId: null}, function(err, root) {
            assert.strictEqual(err, null)
            root.getArrayTree(function (err, tree) {
                assert.strictEqual(err, null)
                assert.strictEqual(tree[0].name, root.name)
                assert.strictEqual(tree[0].parentId, null)

                assert.strictEqual(tree[0].children.length, 2)
                assert.strictEqual(tree[0].children[0].id.toString(), lvl1Id.toString()) // 1st child
                assert.strictEqual(tree[0].children[1].id.toString(), lvl1Id2.toString()) // 2nd child
                done()
            })
        })
    })

    it('should get tree with root static', function (done) {
      NovaModel.GetTree({parentId: null}, function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[RootId.toString()].parentId, null)
            var childKeys = Object.keys(tree[RootId.toString()].children)
            assert.strictEqual(childKeys.length, 2)
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id].id.toString(), lvl1Id.toString()) // 1st child
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id2].id.toString(), lvl1Id2.toString()) // 2nd child
            done()
        })
    })

    it('should get array tree with root static', function (done) {
      NovaModel.GetArrayTree({parentId: null}, function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[0].parentId, null)
            assert.strictEqual(tree[0].children.length, 2)

            for(var i in tree[0].children) {
              assert.strictEqual(tree[0].children[i].parentId.toString(), tree[0].id.toString());
            }
            done()
        })
    })

    it('should get full tree', function (done) {
      NovaModel.GetFullTree(function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[RootId.toString()].parentId, null)
            var childKeys = Object.keys(tree[RootId.toString()].children)
            assert.strictEqual(childKeys.length, 2)
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id].id.toString(), lvl1Id.toString()) // 1st child
            assert.strictEqual(tree[RootId.toString()].children[lvl1Id2].id.toString(), lvl1Id2.toString()) // 2nd child
            done()
        })
    })

    it('should get full array tree', function (done) {
      NovaModel.GetFullArrayTree(function (err, tree) {
            assert.strictEqual(err, null)
            assert.strictEqual(tree[0].parentId, null)
            assert.strictEqual(tree[0].children.length, 2)

            for(var i in tree[0].children) {
              assert.strictEqual(tree[0].children[i].parentId.toString(), tree[0].id.toString());
            }
            done()
        })
    })

  })

  describe('#clean', function () {

    it('sholud remove #1 item', function (done) {
      NovaModel.findOne({id: lvl1Id}, function(err, doc){
            assert.equal(err, null)
            NovaModel.Remove({id: lvl1Id}, function (err) {
                assert.equal(err, null)
                NovaModel.findOne({parentId: lvl1Id}).exec(function (err, child) {
                  assert.strictEqual(err, null)
                  assert.strictEqual(child, null)
                  done()
                })
            })
        })
    })

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

});

/*jslint vars: true, white: true, plusplus: true, node: true, devel: true, indent: 4, maxerr: 50 */
"use strict";

/**
 * Materialized path plugin for mongoose. (MongoDB, NodeJS)
 *
 * Author: Janos Meszaros (janez89)
 * Home: https://github.com/janez89/mongoose-materialized
 */

var Schema = require('mongoose').Schema
    ,async = require('async')
    ,mongoose = require('mongoose');

/**
 * Query for process paramters and mongodb query options
 */
function Query(args) {
    this.callback = null;
    this.query = {};

    if (args.length === 1 && typeof args[0] === 'function') {
        this.callback = args[0];
    } else if (args.length === 1) {
        this.query = args[0] || {};
    } else if (args.length > 1) {
        if (args[args.length -1] && typeof args[args.length -1] === 'function') {
            this.callback = args[args.length -1];
            this.query = args[args.length -2];
        } else {
            this.query = args[args.length -1];
        }
    }

    this.condition = this.query.condition || {};
    this.fields = this.query.fields || null;
    this.sort = this.query.sort || {};
    this.limit = this.query.limit || null;
    this.skip = this.query.skip || 0;
    this.id = this.query.id || null;
}


/**
 * Mongoose materialized path plugin
 */
function materialized(schema, options) {
    options = options || {
        field: '_id',
        separator: ',',
        mapLimit: 5
    };

    if (!options.separator)
        options.separator = ',';

    if (!options.field)
        options.field = '_id';

    if (!options.mapLimit)
        options.mapLimit = 5;


    function byId(value) {
      var cond = {};
      cond[options.field] = value;
      return cond;
    }

    function addId(fields) {
      fields[options.field] = 1;
      return fields;
    }

    // set parentId type
    var parentType = 'ObjectId';
    if (options.field in schema.paths) {
        parentType = schema.paths[options.field].instance === 'ObjectID' ?
            'ObjectId':
            schema.paths[options.field].instance;
    }

    // add custom fields
    schema.add({
        parentId: {
            type: parentType,
            'default': null
        }
    });

    schema.add({
        path: {
            type: 'string',
            required: false
        }
    });
    schema.add({
        '_w': {
            type: 'number',
            'default': 0
        }
    }); // order with weight

    // add indexes
    schema.index({
        parentId: 1
    });
    schema.index({
        path: 1
    });

    // save prevesious version
    schema.path('parentId').set(function(v) {
        //if (v.toString() !== this.parentId.toString()) {
            this.__parentId = this.parentId;
            this.__path = this.path;
            return v;
        //}
    });

    schema.pre('save', function (next, done) {
        var self = this;
        var isPidChange = self.isModified('parentId');

        // updates do not affect structure
        if (!self.isNew && !isPidChange) {
            return next();
        }

        // if create root element
        if (self.isNew && !self.parentId) {
            this.path = '';
            this.parentId = null;
            return next();
        }

        // if create child element
        if (self.isNew && self.parentId) {
            self.constructor.findOne(byId(self.parentId), addId({path: 1})).exec(function (err, parent) {
                if (err || !parent){
                    self.invalidate('parentId', 'Parent not found!');
                    return done(new Error('Parent not found!'));
                }
                self.path = parent.path + options.separator + parent[options.field].toString();
                next();
            });
            return;
        }

        // extisting element and updating structure
        if (!self.isNew && isPidChange) {
            // --- update childs function -----------------------------
            var updateChilds = function(){
                self.constructor.find({
                    path: new RegExp('^'+ self.__path + options.separator + self[options.field].toString(), 'g' )
                }).exec(function(err, docs){
                    // replace from RegExp
                    var regEx = new RegExp('^'+ self.__path, 'g' );
                    // update documents
                    async.mapLimit(docs, options.mapLimit, function(doc, cbNext){
                        doc.path = doc.path.replace(regEx, self.path);
                        doc.save(function(err, data){
                            cbNext(err, data);
                        });
                    }, function(err, results){
                        next();
                    });
                });
            };

            // --- save data end update childs ------------------------
            if (!self.parentId) {
                self.path = '';
                // update childs
                updateChilds();
            } else {
                self.constructor.findOne(byId(self.parentId), addId({path: 1})).exec(function(err, newParent){
                    if (err || !newParent){
                        self.invalidate('parentId', 'Parent not found!');
                        return done(new Error('Parent not found!'));
                    }
                    self.path = newParent.path + options.separator + newParent[options.field].toString();
                    // update childs
                    updateChilds();
                });
            }
        }
    });

    schema.pre('remove', function (next) {
        var self = this;
        self.constructor.remove({
            path: { $regex: (self.path ? '' : '^') + options.separator + self[options.field].toString() }
        }, function(err) {
            next();
        });
    });

    schema.static('Remove', function (conditions, callback) {
        if ('function' === typeof conditions) {
            callback = conditions;
            conditions = {};
        }

        var self = this;
        var promise = new mongoose.Promise;
        if (typeof callback === 'function')
            promise.addBack(callback);

        self.find(conditions).exec(function (err, docs) {
            async.mapLimit(docs, options.mapLimit, function (doc, cbNext) {
                doc.remove(function (err) {
                    cbNext(err, null);
                });
            }, function (err, res) {
                if (err)
                    return promise.error(err);
                promise.complete();
            });
        });
        return promise;
    });

    schema.method('setParent', function(elementOrId){
        //if (elementOrId._id)
        //    return this.__parent = elementOrId;
        this.parentId = elementOrId;
    });

    // --- checkers ------------------------------------------------
    schema.static('IsRoot', function (elOrId, callback) {
        var id = elOrId[options.field] || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId[options.field])
            promise.complete(el.path.length === 0);
        else {
            self.constructor.findOne(byId(id), addId({path: 1})).exec(function (err, doc) {
                if (err || !doc)
                    return promise.error(err);
                promise.complete(doc.path.length === 0);
            });
        }
        return promise;
    });

    schema.method('isRoot', function (callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        promise.complete(self.path.length === 0);
        return promise;
    });

    schema.static('IsLeaf', function (elOrId, callback) {
        var id = elOrId[options.field] || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);

        self.constructor.findOne({
            parentId: id
        }, addId()).exec(function (err, doc) {
            if (err || !doc)
                return promise.error(err);
            promise.complete(doc === null);
        });

        return promise;
    });

    schema.method('isLeaf', function (callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);

        self.constructor.findOne({
            parentId: self[options.field]
        }, addId()).exec(function (err, doc) {
            if (err)
                return promise.error(err);
            promise.complete(doc === null);
        });

        return promise;
    });

    schema.method('isParent', function (elOrId, callback) {
        var id = elOrId[options.field] || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);
        promise.complete(this.path.indexOf(options.separator + id) !== -1);
        return promise;
    });

    schema.method('isDescendant', function (elOrId, callback) {
        var id = elOrId[options.field] || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId[options.field]) {
            promise.complete(el.path.indexOf(options.separator + self[options.field].toString()));
        } else {
            self.constructor.findOne(byId(id), addId({path: 1, parentId: 1}))
            .exec(function (err, doc) {
                if (err || !doc)
                    return promise.error(err);
                promise.complete(doc.path.indexOf(options.separator + self[options.field].toString()));
            });
        }
        return promise;
    });

    schema.method('isSibling', function (elOrId, callback) {
        var id = elOrId[options.field] || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId[options.field])
            promise.complete(el.parentId.toString() === self.parentId.toString());
        else {
            self.constructor.findOne(byId(id), addId({path: 1, parentId: 1}))
            .exec(function (err, doc) {
                if (err || !doc)
                    return promise.error(err);
                promise.complete(doc.parentId.toString() === self.parentId.toString());
            });
        }
        return promise;
    });

    // --- element getters ------------------------------------------
    schema.method('getParent', function (callback) {
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);
        var self = this;
        self.constructor.findOne(byId(self.parentId), function (err, doc) {
            if (err || !doc)
                promise.error(err);
            else
                promise.complete(doc);
        });
        return promise;
    });

    schema.method('getDescendants', function () {
        var query = new Query(arguments);
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);
        var self = this;

        query.condition.path = {
            $regex: (self.path ? '' : '^') + options.separator + self[options.field].toString()
        };

        query.sort.path = 1;
        query.sort._w = query.sort._w || 1;
            query.sort._w = 1;

        var cursor = self.constructor.find(query.condition, query.fields)
        .sort(query.sort);
        if (query.limit)
            cursor.limit(query.limit);
        if (query.skip)
            cursor.skip(query.skip);
        cursor.exec(function (err, data) {
            if (err)
                promise.error(err);
            else
                promise.complete(data);
        });
        return promise;
    });

    schema.method('getChildren', function(QueryOrCb, callback) {
        if (typeof callback === 'function')
            return this.getDescendants(QueryOrCb, callback);

        return this.getDescendants(QueryOrCb);
    });

    schema.method('getTree', function () {
        var query = new Query(arguments);
        var self = this;
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);

        self.getDescendants(query.query, function (err, childs) {
            if (err)
                return promise.error(err);

            childs.unshift(self);
            promise.complete(self.constructor.ToTree(childs));
        });

        return promise;
    });

    schema.method('getArrayTree', function () {
        var query = new Query(arguments);
        var self = this;
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);

        self.getDescendants(query.query, function (err, childs) {
            if (err)
                return promise.error(err);

            childs.unshift(self);
            promise.complete(self.constructor.ToArrayTree(childs));
        });

        return promise;
    });


    schema.method('getAncestors', function () {
        var promise = new mongoose.Promise;
        var query = new Query(arguments);
        if (query.callback)
            promise.addBack(query.callback);
        var self = this;
        if (self.path.length > 2) {
            var ancArray = self.path.substr(1).split(options.separator);
            query.condition[options.field] = {
                $in: ancArray
            };

            query.sort.path = 1;
            query.sort._w = query.sort._w || 1;

            var cursor = self.constructor.find(query.condition, query.fields)
                .sort(query.sort);

            if (query.limit)
                cursor.limit(query.limit);
            if (query.skip)
                cursor.skip(query.skip);

            cursor.exec(function (err, docs) {
                if (err)
                    promise.error(err);
                else
                    promise.complete(docs);
            });
        } else {
            return promise.complete(null, []);
        }
        return promise;
    });

    schema.method('getSiblings', function () {
        var query = new Query(arguments);
        var self = this;
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);

        query.condition.parentId = self.parentId;
        query.condition[options.field] = { $ne: self[options.field] };

        query.sort.path = 1;
        query.sort._w = query.sort._w || 1;

        var cursor = self.constructor.find(query.condition, query.fields)
            .sort(query.sort);
        if (query.limit)
            cursor.limit(query.limit);
        if (query.skip)
            cursor.skip(query.skip);
        cursor.exec(function (err, docs) {
            if (err)
                return promise.error(err);
            promise.complete(docs);
        });
        return promise;
    });

    schema.virtual('depth').get(function () {
        if (this.__depth || this.__depth === 0)
            return this.__depth;

        return this.__depth = this.path ? this.path.match(new RegExp(options.separator,'g')).length : 0;
    });

    // --- conditions ------------------------------------------
    schema.method('getChildCondition', function getChildCondition() {
        return {
            path: {
                $regex: (self.path ? '' : '^') + options.separator + self[options.field].toString()
            }
        };
    });

    schema.method('getAncestorsCondition', function getAncestorsCondition() {
        var self = this;
        if (self.path.length > 2) {
            var ancArray = self.path.substr(1).split(options.separator);
            var res = {};
            res[options.field] = { $in: ancArray };
            return res;
        }
        return { };
    });

    schema.method('getSiblingsCondition', function getSiblingsCondition() {
        var res = { parentId: self.parentId };
        res[options.field] = { $ne: self[options.field] };
        return res;
    });

    // --- data manupulation -----------------------------------------------------
    schema.method('appendChild', function (child, callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        if (!child.save)
            child = new self.constructor(child);

        child.setParent(self);
        child.save(function(err, doc){
            if (err)
                return promise.error(err);
            promise.complete(doc);
        });

        return promise;
    });

    schema.static('AppendChild', function (parentElOrId, child, callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        if (!child.save)
            child = new self.constructor(child);
        child.setParent(parentElOrId);

        child.save(function (err, doc){
            if (err)
                return promise.error(err);
            promise.complete(doc);
        });

        return promise;
    });

    schema.static('GetChildren', function (id) {
        var query = new Query(arguments);
        var self = this;
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);

        self.findOne(byId(id)).exec(function (err, doc) {
            if (err)
                return promise.error(err);

            doc.getChildren(query.query, function (err, docs) {
                if (err)
                    return promise.error(err);

                promise.complete(docs);
            });
        });
        return promise;
    });

    schema.static('GetRoots', function () {
        var query = new Query(arguments);
        var self = this;
        var promise = new mongoose.Promise;
        if (query.callback)
            promise.addBack(query.callback);

        query.condition.parentId = null;
        query.sort._w = query.sort._w || 1;
        self.find(query.condition)
        .sort(query.sort)
        .exec(function (err, roots) {
            if (err)
                return promise.error(err);
            promise.complete(roots);
        });

        return promise;
    });

    schema.static('ToTree', function (docs, fields) {
        var jdocs = {},
            map = [],
            maxDepth = 0;

        for (var i=0, len=docs.length; i < len; i++) {
            //var el = docs.pop().toObject({virtuals: true});
            var el = docs[i].toObject({virtuals: true});
            if (el.parentId) {
                map[i] = {
                    from : el[options.field].toString(),
                    to   : el.parentId.toString(),
                    depth: el.depth
                };
            }
            // filter selected fields
            if (fields) {
                var selected = {};
                for (var j in fields) {
                    if (fields[j] && typeof el[j] !== 'undefined')
                        selected[j] = el[j];
                }
                jdocs[el[options.field].toString()] = selected;
            } else {
                jdocs[el[options.field].toString()] = el;
            }
        }

        // sort by depth desc
        map.sort(function (a, b) {
            return b.depth - a.depth;
        });

        // for debug
        /*
        console.log("Map log:")
        for(var i in map){
            if (jdocs[map[i].to])
                console.log(jdocs[map[i].to].name +" = "+ jdocs[map[i].from].name);
            else
                console.log("parent = "+ jdocs[map[i].from].name);
        }
        */

        for (var i in map) {
            if (!jdocs[map[i].to])
                continue;

            if (!jdocs[map[i].to].children)
                jdocs[map[i].to].children = {};
            jdocs[map[i].to].children[jdocs[map[i].from][options.field]] = jdocs[map[i].from];
            delete jdocs[map[i].from];
        }

        var sortJdocs = function(obj) {
            var data = [];
            var sorted = {};

            for(var key in obj) {
                if(obj.hasOwnProperty(key)) {
                    data.push(obj[key]);
                }
            }

            // sort by depth desc
            data.sort(function (a, b) {
                return a._w - b._w;
            });

            var dataLength = data.length;
            for (var i=0, len=dataLength; i < len; i++) {
                sorted[data[i]._id] = obj[data[i]._id];

                if(obj[data[i]._id] && obj[data[i]._id].children) {
                    obj[data[i]._id].children = sortJdocs(obj[data[i]._id].children);
                }
            }

            return sorted;
        };

        sortJdocs(jdocs);

        return jdocs;
    });

    // --- Array Tree ---------------------------------------------------------------

    schema.static('ToArrayTree', function (docs, fields) {
        var jdocs = {},
            map = [],
            maxDepth = 0;

        for (var i=0, len=docs.length; i < len; i++) {
            //docs.pop().toObject({virtuals: true});
            var el = docs[i].toObject({virtuals: true});
            if (el.parentId) {
                map[i] = {
                    from : el[options.field].toString(),
                    to   : el.parentId.toString(),
                    depth: el.depth
                };
                if (el.depth > maxDepth)
                    maxDepth = el.depth;
            }
            // filter selected fields
            if (fields) {
                var selected = {};
                for (var j in fields) {
                    if (fields[j] && typeof el[j] !== 'undefined')
                        selected[j] = el[j];
                }
                jdocs[el[options.field].toString()] = selected;
            } else {
                jdocs[el[options.field].toString()] = el;
            }
        }

        // sort by depth desc
        map.sort(function (a, b) {
            return b.depth - a.depth;
        });

        var results = [];
        for(var i in map) {
            if (!(map[i].to in jdocs))
                continue;

            if (!jdocs[map[i].to].children)
                jdocs[map[i].to].children = [];

            jdocs[ map[i].to ].children.push( jdocs[ map[i].from ] );
            jdocs[ map[i].to ].children.sort(function (a, b) {
                return a._w - b._w;
            });
            delete jdocs[map[i].from];
        }

        for(var i in jdocs)
            results.push(jdocs[i]);

        return results;
    });

    // --- Build tree -------------------------------------------------------------

    schema.static('GetTree', function(condition, queryOrCallback, callback) {
        if ( typeof queryOrCallback === 'function'){
            callback = queryOrCallback;
            queryOrCallback = {};
        }

        var self = this;
        var promise = new mongoose.Promise;
        promise.addBack(callback);
        self.findOne(condition).exec(function (err, doc) {
            if (err || !doc)
                return promise.error(err);
            doc.getTree(queryOrCallback, function (err, tree) {
                if (err)
                    return promise.error(err);
                promise.complete(tree);
            });
        });
        return promise;
    });

    schema.static('GetFullTree', function(callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        self.find()
        .sort({path: 1, _w: 1})
        .exec(function (err, docs) {
            if (err)
                return promise.error(err);
            if (docs.length === 0)
                return promise.complete({});
            promise.complete(self.ToTree(docs));
        });
        return promise;
    });

    // --- Get Array Tree ---------------------------------------------------------------------
    schema.static('GetArrayTree', function(condition, queryOrCallback, callback) {
        if ( typeof queryOrCallback === 'function'){
            callback = queryOrCallback;
            queryOrCallback = {};
        }

        var self = this;
        var promise = new mongoose.Promise;
        promise.addBack(callback);
        self.findOne(condition).exec(function (err, doc) {
            if (err || !doc)
                return promise.error(err);
            doc.getArrayTree(queryOrCallback, function (err, tree) {
                if (err)
                    return promise.error(err);
                promise.complete(tree);
            });
        });
        return promise;
    });

    schema.static('GetFullArrayTree', function(callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        self.find()
        .sort({path: 1, _w: 1})
        .exec(function (err, docs) {
            if (err)
                return promise.error(err);
            if (docs.length === 0)
                return promise.complete({});
            promise.complete(self.ToArrayTree(docs));
        });
        return promise;
    });

    // --- Building materialized paths --------------------------------------------------------
    schema.static('Building', function (prepare, callback){
        if (typeof prepare === 'function') {
            callback = prepare;
            prepare = null;
        }

        var self = this;
        var promise = new mongoose.Promise;
        if (typeof callback === 'function')
            promise.addBack(callback);
        var builder = function () {
            var updateChildren = function (pDocs, cbFinish) {
                async.mapLimit(pDocs, options.mapLimit, function (parent, cbNext) {
                    // update children
                    self.update({
                        parentId: parent[options.field]
                    }, {
                        path: (parent.path ? parent.path : '' ) + options.separator + parent[options.field].toString(),
                        _w: 0
                    }, {
                        multi: true
                    }, function (err) {
                        // after updated
                        self.find({ parentId: parent[options.field] }).exec(function (err, docs) {
                            if (docs.length === 0)
                                return cbNext(null);

                            updateChildren(docs, function (err, res) {
                                cbNext(null);
                            });
                        });
                    });
                }, function (err, res) {
                    cbFinish(null);
                });
            };

            self.find({parentId: null}).exec(function (err, docs) {
                // clear path
                self.update({
                    parentId: null
                }, {
                    path: '',
                    _w: 0
                }, {
                    multi: true
                }, function (err) {
                    updateChildren(docs, function (err, result) {
                        promise.complete();
                    });
                });
            });

        };

        if (!prepare) {
            builder();
            return promise;
        }

        if (prepare.remove){
            self.update({}, {
                $unset: prepare.remove
            }, {
               multi: true
            }, function (err) {
                builder();
            });
        }

        return promise;
    });

}

module.exports = materialized;

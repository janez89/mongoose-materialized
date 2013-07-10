/*jslint vars: true, white: true, plusplus: true, node: true, devel: true, indent: 4, maxerr: 50 */
"use strict";

var Schema = require('mongoose').Schema,
    async = require('async'),
    mongoose = require('mongoose');


function materialized(schema, options) {
    options = options || {
        separator: ','
    };

    // add custom fields
    schema.add({
        parentId: {
            type: 'ObjectId',
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

    // prevesious version
    schema.path('parentId').set(function(v){
        this.__parentId = this.parentId;
        this.__path = this.path;
        return v;
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
            self.constructor.findById(self.parentId, {
                _id: 1,
                path: 1
            }).exec(function (err, parent) {
                if (err || !parent){
                    self.invalidate('parentId', 'Parent not found!');
                    return done(new Error('Parent not found!'));
                }
                self.path = parent.path + options.separator + parent._id.toString();
                next();
            });
            return;
        }

        // extisting element and updating structure
        if (!self.isNew && isPidChange) {
            // --- update childs function -----------------------------
            var updateChilds = function(){
                self.constructor.find({
                    path: self.__path + options.separator + self._id.toString()
                }).exec(function(err, docs){
                    var regEx = new RegExp('^'+ options.separator + self.path, 'g' );
                    // update documents
                    async.mapLimit(docs, 5, function(doc, cbNext){
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
                self.constructor.findById(self.parentId, {
                    _id: 1,
                    path: 1
                }).exec(function(err, newParent){
                    if (err || !parent){
                        self.invalidate('parentId', 'Parent not found!');
                        return done(new Error('Parent not found!'));
                    }
                    self.path = newParent.path + options.separator + newParent._id.toString();
                    // update childs
                    updateChilds();
                });
            }
        }
    });

    schema.pre('remove', function (next) {
        if (!this.path) {
            return next();
        }
        next();
    });

    schema.method('setParent', function(elementOrId){
        if (elementOrId._id)
            return this.__parent = elementOrId;
        this.parentId = elementOrId;
    });

    schema.method('toTree', function (callback) {
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        var self = this;

        return promise;
    });

    // --- checkers ------------------------------------------------
    schema.static('IsRoot', function (elOrId, callback) {
        var id = elOrId._id || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId._id)
            promise.complete(el.path.length === 0);
        else {
            self.constructor.findById(id, {
                _id: 1,
                path: 1
            }).exec(function (err, doc) {
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
        var id = elOrId._id || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);

        self.constructor.findOne({
            parentId: id
        }, {
            _id: 1
        }).exec(function (err, doc) {
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
            parentId: self._id
        }, {
            _id: 1
        }).exec(function (err, doc) {
            if (err)
                return promise.error(err);
            promise.complete(doc === null);
        });

        return promise;
    });

    schema.method('isParent', function (elOrId, callback) {
        var id = elOrId._id || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);
        promise.complete(this.path.indexOf(options.separator + id) !== -1);
        return promise;
    });

    schema.method('isDescendant', function (elOrId, callback) {
        var id = elOrId._id || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId._id) {
            promise.complete(el.path.indexOf(options.separator + self._id.toString()));
        } else {
            self.constructor.findById(id, {
                _id: 1,
                path: 1,
                parentId: 1
            }).exec(function (err, doc) {
                if (err || !doc)
                    return promise.error(err);
                promise.complete(doc.path.indexOf(options.separator + self._id.toString()));
            });
        }
        return promise;
    });

    schema.method('isSibling', function (elOrId, callback) {
        var id = elOrId._id || elOrId;
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        if (elOrId._id)
            promise.complete(el.parentId.toString() === self.parentId.toString());
        else {
            self.constructor.findById(id, {
                _id: 1,
                path: 1,
                parentId: 1
            }).exec(function (err, doc) {
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
        self.constructor.findById(self.parentId, function (err, doc) {
            if (err || !doc)
                promise.error(err);
            else
                promise.complete(doc);
        });
        return promise;
    });

    schema.method('getDescendants', function (callback) {
        var promise = new mongoose.Promise;
        if (callback) promise.addBack(callback);
        var self = this;
        self.constructor.find({
            path: {
                $regex: (self.path ? '' : '^') + options.separator + self._id.toString()
            }
        })
            .sort({
                path: 1,
                _w: 1
            })
            .exec(function (err, data) {
                if (err)
                    promise.error(err);
                else
                    promise.complete(data);
            });
        return promise;
    });

    schema.method('getAncestors', function (callback) {
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);
        var self = this;
        if (self.path.length > 2) {
            var ancArray = self.path.substr(1).split(options.separator);
            self.constructor.find({
                _id: {
                    $in: ancArray
                }
            })
                .sort({
                    path: 1,
                    _w: 1
                })
                .exec(function (err, doc) {
                    if (err || !doc)
                        promise.error(err);
                    else
                        promise.complete(doc);
                });
        } else {
            return promise.error(new Error('Not ancestors'), null);
        }
        return promise;
    });

    schema.virtual('depth').get(function () {
        return this.path ? this.path.split(options.separator).length - 1 : 0;
    });

    schema.method('getSiblings', function (callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        self.constructor.find({
            parentId: self.parentId,
            _id: {
                $ne: self._id
            }
        })
            .sort({
                path: 1,
                _w: 1
            })
            .exec(function (err, docs) {
                if (err)
                    return promise.error(err);
                promise.complete(docs);
            });
        return promise;
    });

    // --- conditions ------------------------------------------
    schema.method('getChildCondition', function getChildCondition() {
        return {
            path: {
                $regex: (self.path ? '' : '^') + options.separator + self._id.toString()
            }
        };
    });

    schema.method('getAncestorsCondition', function getAncestorsCondition() {
        var self = this;
        if (self.path.length > 2) {
            var ancArray = self.path.substr(1).split(options.separator);
            return {
                _id: {
                    $in: ancArray
                }
            };
        }
        return { };
    });

    schema.method('getSiblingsCondition', function getSiblingsCondition(){
        return {
            parentId: self.parentId,
            _id: {
                $ne: self._id
            }
        };
    });

    // --- data manupulation -----------------------------------------------------
    schema.method('appendChild', function (child, callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        child.parentId = self._id;
        if (!child.save)
            child = new self.constructor(child);

        child.save(function(err, doc){
            if (err)
                return promise.error(err);
            promise.complete(doc);
        });

        return promise;
    });

    schema.static('addChild', function (parentElOrId, child, callback) {
        var self = this;
        var promise = new mongoose.Promise;
        if (callback)
            promise.addBack(callback);

        if (!child.save)
            child = new self.constructor(child);
        child.setParent(parentElOrId);

        child.save(function(err, doc){
            if (err)
                return promise.error(err);
            promise.complete(doc);
        });

        return promise;
    });

    schema.static('getChilds', function(elOrId, callback) {
        var elOrId = elOrId._id || elOrId;
    });

    schema.static('getRoots', function(callback) {

    });

    schema.static('toTree', function(docs, callback) {

    });

    schema.static('building', function(callback){

    });

}

module.exports = materialized
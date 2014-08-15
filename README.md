# Mongoose Materialized
[![Build Status](https://travis-ci.org/janez89/mongoose-materialized.png?branch=master)](https://travis-ci.org/janez89/mongoose-materialized)
[![NPM version](https://badge.fury.io/js/mongoose-materialized.png)](http://badge.fury.io/js/mongoose-materialized)

A mongoose plugin for the materialized paths.

## Overview
* [Usage](#usage)
* [Examples](#examples)
* [API](#api)
  * [Instructions](#instructions)
  * [Attributes](#attributes)
  * [Static methods](#static-methods)
  * [Methods](#methods)
* [Related Links](#related-links)
* [Changelog](#changelog)
* [Authors](#authors)

---

### Usage

```javascript
var mongoose = require('mongoose'),
    materializedPlugin = require('mongoose-materialized'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/materialized');

var CatSchema = new Schema({
  name: {type: String}
});


CatSchema.plugin(materializedPlugin);

var Cat= mongoose.model('Cat', CatSchema); // Category
```

[Go to contents](#overview)

---

### Examples

Adding root and child element.

**Important**: The model verifies the existence of the parent category before they would save.
Except for the root element or change the parent id not touch.

```javascript
// if you have predefined datas with parent id
Cat.Building(function(){
    // building materialized path
});

// add root element
cat = new Cat({name: "Foods"});
cat.save(function(err, foods){
    // append new sub category
    foods.appendChild({name: "Vegetables"}, function(err, vega){
        // vega: { name: "Vegetables", parentId: [foods ID], path: ',[foods ID]' }
    });
    // or make new
    var vega = new Cat({name: "Vegetables"});
    // saving with append
    foods.appendChild(vega, function(err, data){ ... });
    // or save traditional way
    vega.parentId = foods._id;
    vega.save(function(err, data){ ... });
});

```

Find element and checking the relationship
```javascript
Cat.findOne({parentId: null}, function(err, doc){
    // access to the children
    doc.getChildren(function(err, docs){
        // ...
    });

    // access to the children with condition and sort
    doc.getChildren({
        condition: { name: /^a/ },
        sort: { name: 1 }
    },function(err, docs){
        // ...
    });

    // access to the siblings
    doc.getSiblings(function(err, docs){
        // ...
    });

    // access to the ancestors
    doc.getAncestors(function(err, docs){
        // ...
    });

    // check element is root
    doc.isRoot(function(err, isOk){ ... });

    // check element is leaf
    doc.isLeaf(function(err, isLeaf){ ... });

    // depth virtual attributes
    doc.depth

    // use promise
    doc.getChildren().then(function(docs){
        // ...
    });

    // get doc array tree
    doc.getArrayTree(function(err, tree){
        // ... [ {"_id": "...", "children": [ {...} ]}]
    });

    // get doc tree
    doc.getTree(function(err, tree){
        // ... { "doc ID": { ..., children: { ... } }
    });

    // or get tree with condition and sorting
    doc.getTree({
        condition: { name: /^[a-zA-Z]+$/ },
        sort: { name: 1 }
    }, function(err, tree){
        // ...
    });
});

Cat.GetTree('elemt ID', function (err, tree) {
    // ...
});

Cat.GetArrayTree('elemt ID', function (err, tree) {
    // ...
});

// access for full tree in array
Cat.GetFullArrayTree(function (err, tree) {

});

// access for full tree object
Cat.GetFullTree(function (err, tree) {

});
```

The different arrayTree and simple Tree methods:
arrayTree result: 
```
[ 
    { _id: 53ee2db76f2d838a07a04e6a,
    path: '',
    name: 'Foods',
    __v: 0,
    _w: 0,
    parentId: null,
    depth: 0,
    id: '53ee2db76f2d838a07a04e6a',
    children: [ [Object], [Object] ] 
    }
]
```

and the Tree result: 
```
{ '53ee2db76f2d838a07a04e6a': 
   { _id: 53ee2db76f2d838a07a04e6a,
     path: '',
     name: 'Foods',
     __v: 0,
     _w: 0,
     parentId: null,
     depth: 0,
     id: '53ee2db76f2d838a07a04e6a',
     children: { 
        '53ee2db76f2d838a07a04e6b': [Object] 
        } 
    } 
}
```

Manipulate child element with static method
mongoose-materialized it is possible to use more than one root.
```javascript
Cat.AppendChild('ID', { 'name': 'Meats'}, function(err, doc){ ... });
Cat.getChildren('ID', function(err, childs){ ... });
Cat.getRoots(function(err, roots){
    // root elements
});

// Format tree, sub element stored in children field
Cat.getRoots({ name: "" }).then(function (err, root) {
    root.getChildren().then(function (err, children) {
        console.log( Cat.toTree(children) );
        // or only shown name
        console.log( Cat.toTree(children, { name: 1 }) );
    });
});

```

Hierarchical builder for the existing data.
**Important**: This operation is relatively slow. Use only the conversion.

```javascript
Cat.Building(function(){
    // builded materialized path sturcture
});

// This example convert nested set to materialized path. Use this function to migration.

Cat.Building({
    remove: { lt: 1, gt: 1, children: 1 } // remove nested fields from existsing data
}, function(){
    // building is competted
});
```

[Go to contents](#overview)

---

### API

#### Instructions

The following methods must be used with a callback. The callback method have two arguments. The first error and the second data object.
If all goes well then the error is null.
```javascript
model.calledFunction( function (error, data) {
    if (error)
        // handle error
});
```

The methods with work callback return promise. [Mongoose Promise](https://npmjs.org/package/mpromise)

```javascript
model.calledFunction().then( function (data) {

}, function (err) {
    // handle error
});
```

**Imprtant!** Do not use the following methods:

* Model.findByIdAndUpdate()
* Model.findByOneAndUpdate()
* Model.findByIdAndRemove()
* Model.findByOneAndRemove()
* Model.update() - static version
* instance.update()
* Model.remove() - static version

These functions are not triggered by the removal and saving events.

Instead, the following are recommended:

* instance.save() - saving and update (before use findOne, findById)
* instance.remove() - remove document (before use findOne, findById)
* Model.Remove(condition, callback)

The my ```query``` object is special object for mongo query. This parameter available for functions.
```javascript
var query = {
    // mongo condition
    condition: {
        name: /^a/
    },
    // selected fields
    fields: {
        _id: 1,
        name: 1
    },
    // sorting
    sort: {
        name: -1
    }
};

// Example get chidls with query
doc.getChilds(query, function(err, docs){ ... });
```

To run the tests:

```
npm test
```

[Go to contents](#overview)

---

#### Attributes
Added attributes:

* parentId: Parent item id.
* path: materialized path. Auto generated
* _w: weight for sort
* depth: (virtual) element depth

[Go to contents](#overview)

---

#### Static methods

Similar method has the static begins with the first letter capitalized. (IsLeaft is static and isLeaf non static)

* IsLeaf(ModelOrId, callback)
* IsRoot(ModelOrId, callback)

* GetChildren(ModelOrId, [query,] callback)
* GetRoots([query,] callback)
* GetTree(root condition, [children query,] callback) - get elemets tree with children
* GetFullTree(callback)

* **GetArrayTree**(root condition, [children query,] callback) - get elemets tree with children
* **GetFullArrayTree**(callback)

* Remove(condition, callback) - use this instead of remove.

* AppendChild(ModelOrId, callback)
* ToTree(documentArray, selected fields) Return object, no mongoose document (toObject()). Fields: { name: 1, _id: 1 }
* ToArrayTree(documentArray, selected fields) Return objects in array, no mongoose document (toObject()). Fields: { name: 1, _id: 1 }
* Building([prepare,] callback) - rebuild material path (good for extisting collections - parentId is needed)

[Go to contents](#overview)

---

#### Methods

* isRoot(callback)
* isLeaf(callback)
* isDescendant(callback)
* isParent(ModelOrId, callback)
* isSibling(ModelOrID, callback)

* getParent(callback)
* getDescendants([query,] callback)
* getChildren([query,] callback) alias for getDescendants
* getAncestors([query,] callback)
* getSiblings([query,] callback)
* getTree([query,] callback) - get elemets tree with children
* **getArrayTree([query,] callback)** - get elemets tree with children, array version

* appendChild(model, callback)
* setParent(ModelOrId) - if parameter is ID then check parent existence and set parentId (the model parameter to avoid the query)

* getChildCondition()
* getAncestorsCondition()
* getSiblingsCondition()

[Go to contents](#overview)

---

### Related Links

Inspired by seamless data management.

* [MongoDB Model Tree Structures with Materialized Paths](http://docs.mongodb.org/manual/tutorial/model-tree-structures-with-materialized-paths/)
* [Inspired by mongoose nested set](https://github.com/groupdock/mongoose-nested-set) By @groupdock
* [MongooseJS Doc](http://mongoosejs.com/)

[Go to contents](#overview)

---

### Changelog

### Aug 15, 2014 - version: 0.1.8
* added new static methods: **ToArrayTree(), GetArrayTree(), GetFullArrayTree()**
* added new methods: **getArrayTree()**
* added new tests
* enhancements (toTree, parentId type inherits from _id)
* updated README.md and package dependencies

### July 30, 2014 - version: 0.1.7
* fixed remove parent with `parentId=null` bug
* added new tests
* updated README.md

### Dec 19, 2013 - version: 0.1.6
* added requested function: skip, limit for getDescendants, getChildren, getAncestors, getSiblings
* in tree construction (getTree, buildTree) skip, limit methods is not recommended for use


### Oct 15, 2013 - version: 0.1.5
* fixed typo in 153 line.

### Jun 25, 2013 - version: 0.1.4
* ToTree use virtuals
* better depth solution

### Jun 16, 2013 - version: 0.1.3
* added **GetFullTree** static method
* added prepare for Building - use: Building({ remove: { lt: 1, gt: 1, level: 1 }, function () { });
* added GetFullTree test

### Jun 16, 2013 - version: 0.1.2
* added **getTree** method and **GetTree** static method
* added **Remove** static method for remove with condition
* fixed: getChildren now return promise
* fixed: GetRoots function call
* fixed: GetChildren function call
* Building method already work
* Building tests
* updated README.md

#### Jun 14, 2013 - version: 0.1.1
* added ToTree test
* tempory removed Building static method (thown not implemented error if use)
* fixed: ToTree now return json document. (Not mongoose document)
* updated README.md

#### Jun 10, 2013 - version: 0.1.0
* currently under construction
* added test
* static methods
* before save verifies the existence of parent element
* Query supported methods
* added Travis CI build status
* updated README.md

[Go to contents](#overview)

---

### authors

* Janos Meszaros: [https://github.com/janez89](https://github.com/janez89)

[Go to contents](#overview)

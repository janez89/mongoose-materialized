# Mongoose Materialized
[![Build Status](https://travis-ci.org/janez89/mongoose-materialized.png?branch=master)](https://travis-ci.org/janez89/mongoose-materialized)

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

Important: The model verifies the existence of the parent category before they would save.
Except the root element.
```javascript
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
});
```

Manipulate child element with static method
mongoose-materialized it is possible to use more than one root.
```javascript
Cat.AppendChild('ID', { 'name': 'Meats'}, function(err, doc){ ... });
Cat.getChilds('ID', function(err, childs){ ... });
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

* AppendChild(ModelOrId, callback)
* ToTree(documentArray, selected fields) Return object, no mongoose document (toObject()). Fields: { name: 1, _id: 1 }
* under development! - Building(callback) - rebuild material path (good for extisting collections - parentId is needed)

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

#### Jun 14, 213 - version: 0.1.1
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
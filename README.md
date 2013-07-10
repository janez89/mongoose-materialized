# Mongoose Materialized [![Build Status](https://travis-ci.org/janez89/mongoose-materialized.png?branch=dev)](https://travis-ci.org/janez89/mongoose-materialized)

A mongoose plugin for the materialized paths.

## Overview
* [Usage](#usage)
* [Examples](#examples)
* [API](#api)
  * [Attributes](#attributes)
  * [Static methods](#static-methods)
  * [Methods](#methods)
* [Development](#development)
* [Changelog](#changelog)
* [Authors](#authors)
* [Sponsor](#sponsor)

### Usage

```javascript
var mongoose = require('mongoose'),
    materializedPlugin = require('mongoose-materialized'),
    Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/materialized');

var CatSchema = new Schema({
  name: {type: String}
});


UserSchema.plugin(materializedPlugin);

var Cat= mongoose.model('Cat', CatSchema); // Category
```

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
    // access to the descendants
    doc.getDescendants(function(err, docs){
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

    // depth
    doc.depth
});
```

Manipulate child element with static method
mongoose-materialized it is possible to use more than one root.
```javascript
Cat.addChild('ID', { 'name': 'Meats'}, function(err, doc){ ... });
Cat.getChilds('ID', function(err, childs){ ... });
Cat.getRoots(function(err, roots){
    // root elements
});
Cat.getRootWithChilds('Root ID', function(err, elements){
    // root and child elements
});
// Format tree, sub element stored in childs field
Cat.toTree(docsArray, function(err, tree){
    // { name: '...', chidls: [ { name: '...', childs: [] } ] }
});
```

### API



#### Attributes
Added attributes:

* parentId: Parent item ID
* path: materialized path
* _w: weight for sort
* depth: (virtual) element depth
/*var assert = require('assert'),
    db = require('mongoose');

db.connect(process.env.MONGODB_URI || 'mongodb://localhost/mongoose-materialized');

describe('#cleanup()', function() {
  it('should drop the database and disconnect', function(done) {
    db.connection.db.executeDbCommand({
      dropDatabase: 1
    }, function(err, result) {
      db.disconnect()
      assert.strictEqual(err, null)
      done()
    })

  })
})*/
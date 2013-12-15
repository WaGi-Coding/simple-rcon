/**
 * Dependencies
 **/
var net = require('net')
  , events = require('events')
  , util = require('util')
  , Packet = require('./packet')
  , Protocol = require('./protocol');

var queue = [] // Contains queue of response callbacks

var Rcon = function(options) {
  var self = this;

  // Defaults
  self.host = options.host || '127.0.0.1';
  self.port = options.port || '27015';
  self.password = options.password;
  self.authenticated = false;

  events.EventEmitter.call(this);

  self.connect();
  self.listen();
}

util.inherits(Rcon, events.EventEmitter)

Rcon.prototype.connect = function() {
  var self = this;

  var options = {
    host: self.host
  , port: self.port
  };

  var client = self.client = net.connect(options, function clientConnected() {
    self.emit('connected');
    client.write(Packet.encode(Protocol.SERVERDATA_AUTH, Protocol.AUTH_ID, self.password));
  });
};

/**
 * Set up various event handlers
 */
Rcon.prototype.listen = function() {
  var self = this;
  var client = self.client;

  // Receive server responses
  client.on('data', function(data) {
    var res = Packet.decode(data);
    // console.log('Res'  + JSON.stringify(res)) // Useful debug

    switch(res.type) {
      case Protocol.SERVERDATA_RESPONSE_VALUE :
        if (self.authenticated) {
          var fn = queue.shift();
          if (typeof(fn) == 'function')
            (fn)(res);
        }
        break
      case Protocol.SERVERDATA_AUTH_RESPONSE :
        if (res.body == "") {
          self.authenticated = true
          self.emit('authenticated')
        } else {
          self.emit('error', 'Error: Invalid RCON password')
        }
        break
      default:
        self.emit('error', 'Error: Unknown server response')
        break
    }
  });

  client.on('error', function(e) {
    self.emit('error', e)
  });

  client.on('end', function() {
    self.emit('disconnected')
  });
};

Rcon.prototype.exec = function(cmd, fn) {
  if (this.authenticated) {
    this.client.write(Packet.encode(0x02, Protocol.REQ_ID, cmd));
    queue.push(fn)
  } else {
    this.emit('error', 'Error: Trying to execute commands before connected/authenticated')
  }
};

Rcon.prototype.close = function(fn) {
  this.client.end();
};

module.exports = Rcon;
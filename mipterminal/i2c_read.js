// Note: This sript is intended to be run in the MIP Terminal environment.
// It demonstrates I2C communication with the MLX90835 sensor using SCPI commands.

// Initialize I2C
scpi(":i2c:init");

// Start continuous reading
scpi(":i2c:exch 0x33, 0x81, 0x73");

for(i = 0; i < 10; i++) {
  // Read 8 bytes of measurement
  var resp = String(scpi(":i2c:read 0x33, 8")[0]);
  // Convert CSV hex like "00,00,00,01,0c,89,00" to Int16Array of big-endian words
  var tokens = resp.split(',');
  var bytes = [];
  for (var k = 0; k < tokens.length; k++) {
    var t = (tokens[k] + '').trim();
    if (/^[0-9a-fA-F]{2}$/.test(t)) {
      var v = parseInt(t, 16);
      if (v >= 0) bytes.push(v);
    }
  }
  var pairCount = Math.floor(bytes.length / 2);
  var words = [];
  for (var n = 0; n < pairCount; n++) {
    var hi = bytes[2*n];
    var lo = bytes[2*n+1];
    words.push((hi << 8) | lo);
  }
  var meas;
  try { meas = new Int16Array(words); }
  catch (e) { meas = words; }
  // Print as hex (4-digit uppercase), space-separated
  var out = [];
  for (var m = 0; m < (meas.length || 0); m++) {
    var v = meas[m] & 0xFFFF;
    var s = v.toString(16).toUpperCase();
    while (s.length < 4) s = '0' + s;
    out.push(s);
  }
  print(i, ':', out.join(' '));
  sleep(100);
}

// Deinitialize I2C
scpi(":i2c:deinit");

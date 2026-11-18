/* Floor Panel demo mode: open index.html?demo=1 to see the panel with made-up states,
 * no Home Assistant needed. Uses config.json, or config.example.json if there isn't one yet.
 * Extra switches: &night=1 (after dark), &alerts=1 (bin night, car, open window, heating on),
 * &visitor=1 (doorbell camera). Only loaded when ?demo=1 is in the address. */
(function (global) {
  'use strict';
  var q = new URLSearchParams(location.search);
  var night = q.get('night') === '1';
  var alerts = q.get('alerts') === '1';
  var visitor = q.get('visitor') === '1';
  var nowS = Date.now() / 1000;

  function S(state, attrs) { return { s: String(state), a: attrs || {}, lc: nowS - 1800 }; }
  function W(watts) { return S(watts, { unit_of_measurement: 'W' }); }
  function EUR(v) { return S(v, { unit_of_measurement: 'EUR' }); }

  var counters = {};
  function nth(role) { counters[role] = (counters[role] || 0) + 1; return counters[role] - 1; }

  function fake(id, role) {
    var d = id.split('.')[0];
    var i = nth(role);
    if (d === 'sun') return S(night ? 'below_horizon' : 'above_horizon', {next_rising: iso(1, 7), next_setting: iso(night ? 1 : 0, 19)});
    if (role === 'temperature') return S((20.6 - 0.4 * i).toFixed(1), { unit_of_measurement: '°C' });
    if (role === 'humidity') return S([61, 57, 54, 59, 52, 63][i % 6], { unit_of_measurement: '%' });
    if (role === 'climate') {
      return S(i === 1 ? 'off' : 'heat', { hvac_modes: ['off', 'heat', 'auto'], min_temp: 5, max_temp: 30, target_temp_step: 0.5,
        current_temperature: 20.4, temperature: [20.5, 19, 19.5][i % 3], hvac_action: alerts && i !== 1 ? 'heating' : 'idle' });
    }
    if (role === 'demand') return S(alerts ? [45, 25, 30][i % 3] : 0, { unit_of_measurement: '%' });
    if (role === 'heating') return d === 'climate' ? S(alerts ? 'heat' : 'off', { hvac_action: alerts ? 'heating' : 'idle' }) : S(alerts ? 'on' : 'off');
    if (role === 'presence' || role === 'motion') return S(i === 0 ? 'on' : 'off', { device_class: 'occupancy' });
    if (role === 'window') return S(alerts && i === 0 ? 'on' : 'off', { device_class: 'window' });
    if (role === 'doorbell') return S(visitor ? 'on' : 'off');
    if (role === 'camera') {
      return S('idle', { entity_picture: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#345"/><text x="80" y="50" fill="#fff" font-size="10" font-family="sans-serif" text-anchor="middle">camera picture</text></svg>') });
    }
    if (role === 'weather') {
      return S(night ? 'clear-night' : 'partlycloudy', { temperature: night ? 9 : 14, humidity: 72, wind_speed: 18,
        temperature_unit: '°C', wind_speed_unit: 'km/h' });
    }
    if (role === 'bin_text') return S('Green recycling');
    if (d === 'lock') return S(alerts ? 'unlocked' : 'locked');
    if (role === 'bin_active' || role === 'alert') return S(alerts ? 'on' : 'off');
    if (d === 'alarm_control_panel') return S(night ? 'armed_night' : 'disarmed');
    if (d === 'calendar') return S(alerts ? 'on' : 'off', {start_time: iso(alerts ? 1 : 3, 8)});
    if ( d === 'script' || d === 'scene' || d === 'button' || d === 'input_button') return S('off');
    if (d === 'media_player') return S(night ? 'playing' : 'off', { media_title: 'Rain sounds', volume_level: 0.2 });
    if (d === 'cover') return S('open', { current_position: 100 });
    if (d === 'light' || d === 'switch' || d === 'fan' || d === 'input_boolean') return S(night ? (i % 2 ? 'off' : 'on') : (i === 2 ? 'on' : 'off'));
    if (d === 'binary_sensor') return S(i % 2 ? 'off' : 'on');
    if (d === 'input_text' || d === 'select' || d === 'input_select') return S('Auto');
    return S(String(10 + i * 7));
  }

  function day(offset) { var x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + offset); return x; }
  var forecast = ['cloudy', 'rainy', 'partlycloudy', 'sunny', 'pouring', 'windy', 'cloudy'].map(function (c, i) {
    return { datetime: day(i).toISOString(), condition: c, temperature: [15, 13, 16, 18, 12, 14, 15][i],
      templow: [9, 8, 10, 9, 7, 8, 9][i], precipitation_probability: [20, 80, 30, 5, 95, 40, 25][i] };
  });
  function iso(offsetDays, h, m) { var x = new Date(); x.setDate(x.getDate() + offsetDays); x.setHours(h, m || 0, 0, 0); return x.toISOString(); }
  var EVENTS = [
    [{ summary: 'Window cleaner', start: { dateTime: iso(0, 16) }, end: { dateTime: iso(0, 17) } },
     { summary: "Nana's birthday", start: { date: iso(1, 0).slice(0, 10) }, end: { date: iso(2, 0).slice(0, 10) } }],
    [{ summary: 'Swimming lesson', start: { dateTime: iso(0, 17, 30) }, end: { dateTime: iso(0, 18, 15) } },
     { summary: 'Dentist', start: { dateTime: iso(1, 9, 30) }, end: { dateTime: iso(1, 10) } }]
  ];

  function Demo(opts) {
    this.entities = opts.entities || [];
    this.roles = opts.roles || {};
    this.states = {};
    this.status = 'connecting';
    this.handlers = { states: [], status: [] };
    this.calls = [];
    this.cals = this.entities.filter(function (id) { return id.split('.')[0] === 'calendar'; });
  }
  Demo.prototype.on = function (n, fn) { this.handlers[n].push(fn); return this; };
  Demo.prototype.emit = function (n, a, b) { this.handlers[n].forEach(function (h) { h(a, b); }); };
  Demo.prototype.start = function () {
    var self = this;
    this.entities.forEach(function (id) {
      var f = fake(id, self.roles[id] || '');
      self.states[id] = { entity_id: id, state: f.s, attributes: f.a, last_changed: f.lc * 1000, last_updated: f.lc * 1000 };
    });
    setTimeout(function () {
      self.status = 'online'; self.emit('status', 'online');
      self.emit('states', self.states, self.entities.slice());
    }, 30);
    return Promise.resolve();
  };
  Demo.prototype.set = function (id, state, attrs) {
    var cur = this.states[id];
    if (!cur) return;
    this.states[id] = { entity_id: id, state: state, attributes: Object.assign({}, cur.attributes, attrs || {}), last_changed: Date.now(), last_updated: Date.now() };
    this.emit('states', this.states, [id]);
  };
  Demo.prototype.callService = function (domain, service, data, entityId) {
    var self = this;
    this.calls.push([domain, service, data, entityId]);
    global.__calls = this.calls;
    [].concat(entityId || []).forEach(function (id) {
      var cur = self.states[id];
      if (!cur) return;
      if (service === 'toggle') self.set(id, cur.state === 'on' ? 'off' : cur.state === 'off' ? 'on' : cur.state === 'open' ? 'closed' : 'open');
      else if (service === 'alarm_arm_night') self.set(id, 'armed_night');
      else if (service === 'media_play_pause') self.set(id, cur.state === 'playing' ? 'paused' : 'playing');
      else if (service === 'turn_on') self.set(id, 'on', data);
      else if (service === 'turn_off') self.set(id, 'off');
      else if (service === 'lock') self.set(id, 'locked');
      else if (service === 'set_temperature') self.set(id, cur.state, { temperature: data.temperature });
      else if (service === 'set_hvac_mode') self.set(id, data.hvac_mode);
      else if (service === 'open_cover') self.set(id, 'open', { current_position: 100 });
      else if (service === 'close_cover') self.set(id, 'closed', { current_position: 0 });
    });
    return Promise.resolve();
  };
  Demo.prototype.subscribe = function (msg, cb) {
    if (msg.type === 'weather/subscribe_forecast') setTimeout(function () { cb({ type: msg.forecast_type, forecast: forecast }); }, 40);
    return function () {};
  };
  Demo.prototype.api = function (path) {
    var m = /^calendars\/([^?]+)/.exec(path);
    if (m) return Promise.resolve(EVENTS[this.cals.indexOf(m[1]) % EVENTS.length] || []);
    return Promise.reject(new Error('demo: ' + path));
  };
  Demo.prototype.url = function (p) { return p; };

  global.HALiteDemo = Demo;
})(window);

/* Demo build: this public page never connects to a Home Assistant. Made-up states come from demo.js.
 * The connection script ships only in the Floor Panel Starter Kit. */
(function (global) {
  'use strict';
  global.HALite = { create: function (opts) { return new global.HALiteDemo(opts); } };
})(window);

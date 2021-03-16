'use strict';
/* 
   A version of setInterval() for nodejs, that does not spin cpus nor drift.
   The returned value is an object with a clear() methods that stops the interval.

   We do three things:
   1. Keep a running counter of when the next call should be, to avoid drift.
   2. Compute the time to the next call and give that to setTimeout.
   3. Our average error with the above is about 1ms (so half the intervals are off by more). 
      So in #2, shoot for 2 ms less than that, and spin with setImmediate (allowing 
      other stuff to run) until we've reached the expected time.
      
   For a 10ms interval, I measured an AVERAGE error per interval of:
   1.67 ms for setInterval (so SOMETHING is ticking at 60 Hz).
   ~1 ms for this code WITHOUT #3, using Date.getTime
   ~1 ms for this code WITHOUT #3, using perf_hooks.performance.now
   0.86 ms for this code using Date.getTime
   0.03 ms for this code using perf_hooks.performance.now
*/
  
const { performance: {now} } = require('perf_hooks');

module.exports = function preciseInterval(func, interval) {
    let nextTick = now();
    let clear = clearTimeout;
    let wrapper = function wrapper() {
        let thisTick = now();
        if (thisTick < nextTick) {
            clear = clearImmediate;
            return timeout = setImmediate(wrapper);
        }
        nextTick += interval;
        clear = clearTimeout;
        timeout = setTimeout(wrapper, nextTick - thisTick - 2);
        func();
    };
    let timeout = setTimeout(wrapper);
    return {clear: () => clear(timeout)};
};

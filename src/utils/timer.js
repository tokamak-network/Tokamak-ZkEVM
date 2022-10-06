/**
 * Start off a timer
 * @return {Date}
 */
export function start() {
  return new Date();
};

/**
 * Get the elapsed time since starttime
 * @param  {Date} startTime
 * @return {number}
 */
export function end(startTime) {
  return new Date() - startTime;
}

/**
 * Get the elapsed time since startTime,
 * print it on console log,
 * return new Date object
 * @param {Date} startTime
 * @return {Date}
 */
export function check(startTime) {
  const endTime = new Date();
  const timeDiff = endTime - startTime;

  const seconds = Math.round(timeDiff);
  console.log(`Elapsed time: ${seconds} [ms]`);
  return endTime;
}

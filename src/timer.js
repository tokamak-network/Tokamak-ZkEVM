
export function start() {
  return new Date();
};


export function end(startTime) {
  const endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  //timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  console.log(`Elapsed time: ${seconds} [ms]`);
}

export function check(startTime) {
  const endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  //timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  console.log(`Elapsed time: ${seconds} [ms]`);
  return endTime;
}
import { exec } from 'child_process';

function execP(cmd) {
  return new Promise(function(resolve, reject) {
      exec(cmd, function(err, stdout, stderr) {
          if (err) {
              reject(err);
          } else {
              resolve({stdout, stderr});
          }
      });
  });
}

function test() {
  
    // exec(`/home/ubuntu/rapidsnark/build/tensorProduct /home/ubuntu/UniGro16js/resource/circuits/test_transfer/parallel/test_0_0.zkey /home/ubuntu/UniGro16js/resource/circuits/test_transfer/parallel/test_wtns_0.zkey`, function  (error, stdout, stderr) {
    
    exec('ls -al', function  (error, stdout, stderr) {
      if (error) console.log(error);
      if (stderr) console.log (stderr);
      console.log(stdout)
    })

  
}

test()
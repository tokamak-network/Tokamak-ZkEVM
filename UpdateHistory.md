# Update History
## Aug. 30, 2022
The first demo version of Universal Groth16 was released.
## Sep. 22, 2022
The codes for algorithms were optimized, and the proving time for an Ether transfer circuit was reduced _from 6.5 hours to 5.04 hours_.
## Nov. 18, 2022
Circom codes for subcircuits of EVM opcodes were fixed to cover almost every EVM-compatibility test.
## Jan. 17, 2023
For multiplication and division of polynomials, FFTs were applied, and the proving time for an Ether transfer circuit was reduced _from 5.04 hours_ (with convolution of coefficients) _to 17.92 mins_.
## Jan. 19, 2023
Continuous integration (CI) workflow was added to the repository with automated lint check and integration tests.
## Feb. 2, 2023
A docker image for Circom environment was installed for the automated integration tests.
## Feb. 16, 2023
An interactive command line interface has been added to improve user experience.
## Apr. 27, 2023
For division of QAP polynomials, [an efficient algorithm](https://drive.google.com/file/d/1mhSafDcquDRZpaBX_0pHL1uuzH-rfym1/view?usp=share_link) was applied, and the dividing time for an Ether transfer circuit was reduced _from 11.74 mins_ (with polynomial long division and FFT) _to 68 milliseconds_ (the total proving time was reduced _from 17.92 mins to 6.03 mins_).
## May 24, 2023
For multi-scalar exponentiations (MSM), [a batched computation using WASM provided by Iden3](https://github.com/iden3/ffjavascript/blob/master/src/engine_multiexp.js) was applied, and the MSM time for an Ether transfer circuit was reduced _from 25.9 secs_ (with separated computation) _to 0.6 secs_.

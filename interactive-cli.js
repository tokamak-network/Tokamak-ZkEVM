/* eslint-disable no-console */

import glob from 'glob';
import path from 'path';
import isValidFilename from 'valid-filename';
import fuzzy from 'fuzzy';
import inquirer from 'inquirer';
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import * as zkey from './src/zkey.js';
import Logger from 'logplease';
const logger = Logger.create('UniGro16js', {showTimestamp: false});
import { exec } from 'child_process';
import { Decoder } from './src/decode.js';
import fs from 'fs'

Logger.setLogLevel('INFO');

inquirer.registerPrompt('autocomplete', inquirerPrompt);

inquirer
  .prompt([
    {
      type: 'list',
      name: 'phase',
      message: 'Which function do you want to run?',
      choices: [
        'Compile',
        'Build QAP',
        'Setup',
        'Decode',
        'Derive',
        'Prove',
        'Verify',
        'Test (for developers)'
      ],
    },
    {
      type: 'confirm',
      name: 'verbose',
      message: 'Do you want to activate verbose mode?',
      default: false,
    }
  ])
  .then(answers => {
    if (answers.verbose) Logger.setLogLevel("DEBUG");
    if (answers.phase === 'Compile') compile(answers.verbose);
    if (answers.phase === 'Build QAP') buildQAP();
    if (answers.phase === 'Decode') decode();
    if (answers.phase === 'Setup') setup();
    if (answers.phase === 'Derive') derive();
    if (answers.phase === 'Prove') prove();
    if (answers.phase === 'Verify') verify();
    if (answers.phase === 'Test (for developers)') tests();
  })
  .catch(error => {
    if (error.isTtyError) {
      // Prompt couldn't be rendered in the current environment
      console.log('Prompt couldn\'t be rendered in the current environment.')
    } else {
      // Something else when wrong
      console.log(error);
    }
  })

function compile(verbose) {
  exec(path.join('resource','subcircuits','compile.sh'),
        (error, stdout, stderr) => {
          
          if (verbose) console.log(stdout);
            console.log(stderr);
            if (error !== null) {
                console.log(`exec error: ${error}`);
            }
        });
}

function buildQAP() {
  inquirer
    .prompt([
      {
        type: 'list',
        name: 'curve',
        message: 'What is the name of curve?',
        choices: [
          'BN128',
          'BN254',
          'ALTBN128',
          'BLS12381',
        ]
      },
      {
        type: 'input',
        name: 'sD',
        message: 'How many instructions are defined in the EVM?',
        default: '12',
        validate: value => {
          return !isNaN(value) && Number.isInteger(Number(value)) ? true : 'Please enter a valid integer';
        }
      },
      {
        type: 'input',
        name: 'sMax',
        message: 'The maximum number of arithmetic instructions in the EVM application?',
        default: '18',
        validate: value => {
          return !isNaN(value) && Number.isInteger(Number(value)) ? true : 'Please enter a valid integer';
        }
      },
    ])
    .then(
      answers => {
        return zkey.buildQAP(answers.curve, answers.sD, answers.sMax, logger);
      }
    )
}

function setup() {
  const parameterFileList = fromDir(path.join('resource','subcircuits'), '*.dat');
  function searchParameterFile(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, parameterFileList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }

  const qapDirList = fromDir(path.join('resource','subcircuits','QAP*'), '');
  function searchQapDirectory(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, qapDirList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  
  inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'parameterFile',
        suggestOnly: true,
        message: 'Which parameter file will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchParameterFile,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'qapDirectory',
        suggestOnly: true,
        message: 'Which QAP will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchQapDirectory,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'input',
        name: 'referenceString',
        message: 'What is the name of the universial reference string file?',
        default: 'rs',
        validate: value => {
          return isValidFilename(value) ? true : 'Please enter a valid file name';
        }
      }
    ])
    .then(answers => {
      return zkey.setup(answers.parameterFile, answers.referenceString, answers.qapDirectory, logger);
    })
}

function derive() {
  const circuitNameList = fromDir(path.join('resource','circuits'), '*');
  function searchCircuitName(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, circuitNameList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const referenceStringList = fromDir(path.join('resource','universal_rs'), '*.urs');
  function searchReferenceString(answers, input = '') {
    referenceStringList
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, referenceStringList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const qapDirList = fromDir(path.join('resource','subcircuits','QAP*'), '');
  function searchQapDirectory(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, qapDirList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'circuitName',
        suggestOnly: true,
        message: 'Which circuit will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitName,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'referenceStringFile',
        suggestOnly: true,
        message: 'Which reference string file will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchReferenceString,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'qapDirectory',
        suggestOnly: true,
        message: 'Which QAP will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchQapDirectory,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'input',
        name: 'circuitSpecificReferenceString',
        message: 'What is the name of the circuit-specific reference string file?',
        default: 'circuit',
        validate: value => {
          return isValidFilename(value) ? true : 'Please enter a valid file name';
        }
      }
    ])
    .then(answers => {
      return zkey.derive(
        answers.referenceStringFile, 
        answers.circuitSpecificReferenceString, 
        answers.circuitName,
        answers.qapDirectory, 
        logger
        );
    })
}

function decode() {
  const circuitNameList = fromDir('/resource/circuits/', '*');
  function searchCircuitName(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, circuitNameList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  inquirer
    .prompt([
      // {
      //   type: 'list',
      //   name: ''
      // }
      {
        type: 'autocomplete',
        name: 'circuitName',
        suggestOnly: true,
        message: 'Which circuit will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitName,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
    ])
    .then(answers => {
      const json = fs.readFileSync(`${answers.circuitName}/config.json`, 'utf8')
      const jsonData = JSON.parse(json);
      const { config, code } = jsonData
      const decode = new Decoder()
      return decode.runCode(
        Buffer.from(code.join(''), 'hex'),
        config,
        answers.circuitName
      )
    })
}

function prove() {
  const qapDirList = fromDir(path.join('resource','subcircuits','QAP*'), '');
  function searchQapDirectory(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, qapDirList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const circuitNameList = fromDir(path.join('resource','circuits'), '*');
  function searchCircuitName(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, circuitNameList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const circuitSpecificReferenceStringList = (answers) => {
    return fromDir2(answers, '*.crs');
  }
  function searchCircuitSpecificReferenceString(answers, input = '') {
    const referenceStringList = circuitSpecificReferenceStringList(answers.circuitName)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, referenceStringList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'qapDirectory',
        suggestOnly: true,
        message: 'Which QAP will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchQapDirectory,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'circuitName',
        suggestOnly: true,
        message: 'Which circuit will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitName,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'circuitSpecificReferenceString',
        suggestOnly: true,
        message: 'Which circuit-specific reference string will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitSpecificReferenceString,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'input',
        name: 'istanceId',
        message: 'What is the index of the instance of the circuit?',
        default: '',
        validate: value => {
          return !isNaN(value) && Number.isInteger(Number(value)) ? true : 'Please enter a valid integer';
        }
      },
      {
        type: 'input',
        name: 'proofName',
        message: 'What is the name of the proof?',
        default: 'proof',
        validate: value => {
          return isValidFilename(value) ? true : 'Please enter a valid file name';
        }
      },
    ])
    .then(answers => {
      return zkey.groth16Prove(
        answers.qapDirectory,
        answers.circuitSpecificReferenceString, 
        answers.proofName, 
        answers.circuitName, 
        answers.istanceId, 
        logger
      );
    })
}

function verify() {
  const circuitNameList = fromDir(path.join('resource','circuits'), '*');
  function searchCircuitName(answers, input = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, circuitNameList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const circuitSpecificReferenceStringList = (answers) => {
    return fromDir2(answers, '*.crs');
  }
  function searchCircuitSpecificReferenceString(answers, input = '') {
    const referenceStringList = circuitSpecificReferenceStringList(answers.circuitName)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, referenceStringList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  const proofFileList = (answers) => {
    return fromDir2(answers, '*.proof');
  } 
  function searchProofFile(answers, input = '') {
    const proofList = proofFileList(answers.circuitName)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(fuzzy.filter(input, proofList).map((el) => el.original));
      }, Math.random() * 470 + 30);
    });
  }
  inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'circuitName',
        suggestOnly: true,
        message: 'Which circuit will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitName,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'autocomplete',
        name: 'circuitSpecificReferenceString',
        suggestOnly: true,
        message: 'Which circuit-specific reference string will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchCircuitSpecificReferenceString,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },
      {
        type: 'input',
        name: 'istanceId',
        message: 'What is the index of the instance of the circuit?',
        default: '',
        validate: value => {
          return !isNaN(value) && Number.isInteger(Number(value)) ? true : 'Please enter a valid integer';
        }
      },
      {
        type: 'autocomplete',
        name: 'proofFile',
        suggestOnly: true,
        message: 'Which proof will you use?',
        searchText: 'Searching...',
        emptyText: 'Nothing found!',
        source: searchProofFile,
        pageSize: 4,
        validate: val => {
          return val ? true : 'Use arrow keys or type to search, tab to autocomplete';
        },
      },

    ])
    .then(answers => {
      return zkey.groth16Verify(
        answers.proofFile,
        answers.circuitSpecificReferenceString,
        answers.circuitName,
        answers.istanceId,
        logger
      )
    })
}
function tests() {
  inquirer
  .prompt([
    {
      type: 'input',
      name: 'password',
      message: 'Enter password',
      default: '',
      validate: value => {
        return value ? true : 'Please enter a valid password';
      }
    },
  ])
  .then(answers => {
    return zkey.tests(logger);
  })
}

// get file names from directory
function fromDir (directory = '', filter = '/*') {
  const __dirname = path.resolve();
  const __searchkey = path.join(__dirname, directory, filter)
  const res = glob.sync(__searchkey.replace(/\\/g, '/'));
  return res;
}

function fromDir2 (directory = '', filter = '/*') {
  const __searchkey = path.join(directory, filter)
  const res = glob.sync(__searchkey.replace(/\\/g, '/'));
  return res;
}
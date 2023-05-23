export const subcircuit = {
	"wire-list": [
		{
			"id": 0,
			"opcode": "fff",
			"name": "LOAD",
			"Nwires": 33,
			"Out_idx": [
				1,
				16
			],
			"In_idx": [
				17,
				16
			]
		},
		{
			"id": 1,
			"opcode": "01",
			"name": "ADD",
			"Nwires": 5,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 2,
			"opcode": "02",
			"name": "MUL",
			"Nwires": 4,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 3,
			"opcode": "03",
			"name": "SUB",
			"Nwires": 5,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 4,
			"opcode": "04",
			"name": "DIV",
			"Nwires": 7,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 5,
			"opcode": "20",
			"name": "SHA3",
			"Nwires": 4,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 6,
			"opcode": "05",
			"name": "SDIV",
			"Nwires": 50,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 7,
			"opcode": "06",
			"name": "MOD",
			"Nwires": 5,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 8,
			"opcode": "07",
			"name": "SMOD",
			"Nwires": 54,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 9,
			"opcode": "08",
			"name": "ADDMOD",
			"Nwires": 16,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				3
			]
		},
		{
			"id": 10,
			"opcode": "09",
			"name": "MULMOD",
			"Nwires": 17,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				3
			]
		},
		{
			"id": 11,
			"opcode": "0a",
			"name": "EXP",
			"Nwires": 32,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 12,
			"opcode": "10",
			"name": "LT",
			"Nwires": 255,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 13,
			"opcode": "11",
			"name": "GT",
			"Nwires": 255,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 14,
			"opcode": "12",
			"name": "SLT",
			"Nwires": 294,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 15,
			"opcode": "13",
			"name": "SGT",
			"Nwires": 294,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 16,
			"opcode": "14",
			"name": "EQ",
			"Nwires": 5,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 17,
			"opcode": "15",
			"name": "ISZERO",
			"Nwires": 4,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				1
			]
		},
		{
			"id": 18,
			"opcode": "16",
			"name": "AND",
			"Nwires": 760,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 19,
			"opcode": "17",
			"name": "OR",
			"Nwires": 760,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 20,
			"opcode": "18",
			"name": "XOR",
			"Nwires": 760,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 21,
			"opcode": "19",
			"name": "NOT",
			"Nwires": 255,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				1
			]
		},
		{
			"id": 22,
			"opcode": "1b",
			"name": "SHL",
			"Nwires": 18,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 23,
			"opcode": "1c1",
			"name": "SHR-L",
			"Nwires": 21,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 24,
			"opcode": "1c2",
			"name": "SHR-H",
			"Nwires": 21,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 25,
			"opcode": "1d",
			"name": "SAR",
			"Nwires": 288,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 26,
			"opcode": "0b",
			"name": "SIGNEXTEND",
			"Nwires": 290,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		},
		{
			"id": 27,
			"opcode": "1a",
			"name": "BYTE",
			"Nwires": 276,
			"Out_idx": [
				1,
				1
			],
			"In_idx": [
				2,
				2
			]
		}
	]
}
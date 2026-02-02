export const SYNTHID_ADDRESS = '0x0000000000000000000000000000000000000000' as const; // TODO: Update after deployment

export const SYNTHID_ABI = [
  // register
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'platform', type: 'string' },
      { name: 'platformId', type: 'string' },
      { name: 'avatar', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    name: 'register',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  // getAgentIdentity
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentIdentity',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'platform', type: 'string' },
      { name: 'platformId', type: 'string' },
      { name: 'agentURI', type: 'string' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'owner', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // getAgentProfile
  {
    inputs: [{ name: 'agentId', type: 'uint256' }],
    name: 'getAgentProfile',
    outputs: [
      { name: 'avatar', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'skills', type: 'string[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // updateProfile
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'avatar', type: 'string' },
      { name: 'description', type: 'string' },
    ],
    name: 'updateProfile',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // setSkills
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'skills', type: 'string[]' },
    ],
    name: 'setSkills',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // setAgentURI
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'agentURI', type: 'string' },
    ],
    name: 'setAgentURI',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // getMetadata
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    name: 'getMetadata',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function',
  },
  // setMetadata
  {
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    name: 'setMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // walletToId
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'walletToId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // platformIndex
  {
    inputs: [{ name: '', type: 'bytes32' }],
    name: 'platformIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // getByPlatform
  {
    inputs: [
      { name: 'platform', type: 'string' },
      { name: 'platformId', type: 'string' },
    ],
    name: 'getByPlatform',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // hasId
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'hasId',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // tokenURI
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  // mintFee
  {
    inputs: [],
    name: 'mintFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // totalMinted
  {
    inputs: [],
    name: 'totalMinted',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // nextId
  {
    inputs: [],
    name: 'nextId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

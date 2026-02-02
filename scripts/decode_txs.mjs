import { createPublicClient, http, decodeFunctionData, parseAbi } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({ chain: bsc, transport: http('https://bsc-dataseed1.defibit.io') });
const ABI = parseAbi([
  'function registerToken(address token, string agentName)',
]);

const txHashes = [
  '0x42d0b4d53a079b03a8a447289ab9af4fd0c0d198aa7f44a1f108371079a20a34',
  '0x467f39a7883e8a1f1bc15413a6e4dc22800e0c31614aa9bf2ed31fcd071c399b',
  '0x4736842b5505e08a0d188a079ad1cc92021bb07e8478ba3af396d61edcb6c2e3',
  '0xb25d053c1c8e0d33a127c61d3f8800d8c663a167a03a9a95ef111d1d7e653da5',
  '0x5b29c73da3258a11327fb561fc5d9938090822dae1cb506a6b4857393eef1563',
  '0x99d21e3c9ea0815f93915c1d0a4617117328da90bbb62b851283460862b84dea',
  '0xd0bc84ed65da9e88f560eb148192e694d1ea2ba2dcd311ea0a2617869488980f',
  '0x94026d79a4d3a3bd4ca35768aa0fc8c9fb7829132774cbd4d1f3eee1e885ca3c',
  '0xbfd230cf4c4026113fb0b3275ef095ca6458dd2b862de96025ade278fcc3483f',
  '0x9c287bcd57ffd2892eea74c658bd448041aa1b691c44132914dc479ece01016b',
  '0xb695ebd25548329a5e5e9981fec615a3de0466a792bd7908eec3c7164c1cfc44',
  '0x3fd4c04bab674882b97e70147433bb3967d854a51021f70bedfef50eac6f93e7',
  '0x61383f766c8caffaa853c1c48e02e3a97793203eba00631e1d1194a7e42ef63e',
];

for (const hash of txHashes) {
  const tx = await client.getTransaction({ hash });
  try {
    const decoded = decodeFunctionData({ abi: ABI, data: tx.input });
    console.log(`${decoded.args[0].toLowerCase()}|${decoded.args[1]}`);
  } catch(e) {
    console.log(`ERROR|${hash}`);
  }
}

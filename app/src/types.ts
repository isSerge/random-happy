export interface TransactionData {
  address: `0x${string}`,
  abi: any,
  functionName: string,
  args: any[],
  deadline: BigInt,
}
